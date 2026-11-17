/**
 * node test.mjs
 *
 * Starts server.mjs the way an MCP client would and talks to it over stdio:
 * once with no API key (what a directory's check sees), and once with a key
 * against a stand-in for the hosted server running on this machine.
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SERVER = fileURLToPath(new URL('./server.mjs', import.meta.url))
const SNAPSHOT = JSON.parse(readFileSync(new URL('./tools.json', import.meta.url), 'utf8'))

let passed = 0
const failures = []
function check(name, ok) { if (ok) passed++; else failures.push(name) }

/** Send these messages, one per line; resolve with the responses by id. */
function talk(env, messages, expectResponses) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER], { env: { ...process.env, GROUNDBASE_API_KEY: '', GROUNDBASE_MCP_URL: '', ...env }, stdio: ['pipe', 'pipe', 'pipe'] })
    const byId = new Map()
    const stdoutLines = []
    let stderr = ''
    let buf = ''
    const timer = setTimeout(() => { child.kill(); reject(new Error(`timed out; got ${byId.size}/${expectResponses}; stderr: ${stderr}`)) }, 15000)
    child.stdout.on('data', (d) => {
      buf += d
      let i
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1)
        if (!line.trim()) continue
        stdoutLines.push(line)
        try { const m = JSON.parse(line); byId.set(m.id, m) } catch { /* counted below */ }
        if (byId.size >= expectResponses) child.stdin.end()
      }
    })
    child.stderr.on('data', (d) => { stderr += d })
    // A server that refuses to start closes stdin before we finish writing.
    child.stdin.on('error', () => {})
    child.on('close', (code) => { clearTimeout(timer); resolve({ byId, stdoutLines, stderr, code }) })
    for (const m of messages) child.stdin.write(JSON.stringify(m) + '\n')
    if (expectResponses === 0) child.stdin.end()
  })
}

const init = (version = '2025-06-18') => ({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: version, capabilities: {}, clientInfo: { name: 'test', version: '0' } } })
const initialized = { jsonrpc: '2.0', method: 'notifications/initialized' }

// ── no key: starts, introduces itself, lists tools, refuses to run them ──────
{
  const r = await talk({}, [
    init(), initialized,
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'contacts_list', arguments: {} } },
    { jsonrpc: '2.0', id: 4, method: 'ping' },
    { jsonrpc: '2.0', id: 5, method: 'resources/list' },
  ], 5)
  const i = r.byId.get(1)?.result
  check('initialize: echoes a supported protocol version', i?.protocolVersion === '2025-06-18')
  check('initialize: tools capability and a name', !!i?.capabilities?.tools && i?.serverInfo?.name === 'groundbase-crm')
  check('initialize: instructions say a key is missing', /No Groundbase API key/.test(i?.instructions ?? ''))
  const tools = r.byId.get(2)?.result?.tools
  check('tools/list: the snapshot, every tool', Array.isArray(tools) && tools.length === SNAPSHOT.length && tools.length > 40)
  check('tools/list: each tool has a name, a description and an object schema', tools?.every((t) => typeof t.name === 'string' && typeof t.description === 'string' && t.inputSchema?.type === 'object'))
  const call = r.byId.get(3)?.result
  check('tools/call without a key: a readable failure, not a crash', call?.isError === true && /GROUNDBASE_API_KEY/.test(call?.content?.[0]?.text ?? ''))
  check('ping answers', JSON.stringify(r.byId.get(4)?.result) === '{}')
  check('an unknown method is refused by code', r.byId.get(5)?.error?.code === -32601)
  check('the notification got no answer', r.byId.size === 5)
  check('stdout carries only JSON-RPC lines', r.stdoutLines.every((l) => { try { return JSON.parse(l).jsonrpc === '2.0' } catch { return false } }))
  check('the server says on stderr that no key is set', /NO API key/.test(r.stderr))
  check('exits cleanly when the client closes stdin', r.code === 0)
}
{
  const r = await talk({}, [init('1999-01-01')], 1)
  check('an unknown protocol version is answered with the latest', r.byId.get(1)?.result?.protocolVersion === '2025-06-18')
  const bad = await talk({}, [{ jsonrpc: '2.0', id: 9, method: 'ping' }], 1)
  check('a line that is not JSON is a parse error and the server lives on', await (async () => {
    const x = await new Promise((resolve) => {
      const child = spawn(process.execPath, [SERVER], { env: { ...process.env, GROUNDBASE_API_KEY: '' }, stdio: ['pipe', 'pipe', 'ignore'] })
      let out = ''
      child.stdout.on('data', (d) => { out += d; if (out.split('\n').filter(Boolean).length >= 2) child.stdin.end() })
      child.on('close', () => resolve(out.split('\n').filter(Boolean).map((l) => JSON.parse(l))))
      child.stdin.write('this is not json\n')
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'ping' }) + '\n')
    })
    return x[0]?.error?.code === -32700 && x[1]?.id === 7
  })() && bad.byId.get(9) !== undefined)
}

// ── with a key: everything goes to the hosted server, with the key ───────────
{
  const seen = []
  const fake = createServer((req, res) => {
    let body = ''
    req.on('data', (d) => { body += d })
    req.on('end', () => {
      const msg = JSON.parse(body)
      seen.push({ auth: req.headers.authorization, method: msg.method, params: msg.params, version: req.headers['mcp-protocol-version'] })
      if (req.headers.authorization !== 'Bearer gbm_test_key') { res.writeHead(401, { 'content-type': 'application/json' }); return res.end('{"error":"invalid_token"}') }
      res.writeHead(200, { 'content-type': 'application/json' })
      if (msg.method === 'tools/list') return res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { tools: [{ name: 'live_tool', description: 'from the hosted server', inputSchema: { type: 'object' } }] } }))
      if (msg.method === 'tools/call' && msg.params?.name === 'nope') return res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code: -32602, message: 'Unknown tool: nope' } }))
      return res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: `ran ${msg.params?.name}` }] } }))
    })
  })
  await new Promise((r) => fake.listen(0, '127.0.0.1', r))
  const url = `http://127.0.0.1:${fake.address().port}/mcp`

  const r = await talk({ GROUNDBASE_API_KEY: 'gbm_test_key', GROUNDBASE_MCP_URL: url }, [
    init('2025-03-26'), initialized,
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'contacts_list', arguments: { search: 'pat' } } },
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'nope', arguments: {} } },
  ], 4)
  check('with a key the instructions do not complain', !/No Groundbase API key/.test(r.byId.get(1)?.result?.instructions ?? ''))
  check('tools/list comes from the hosted server, not the snapshot', r.byId.get(2)?.result?.tools?.[0]?.name === 'live_tool')
  check('tools/call returns the hosted result untouched', r.byId.get(3)?.result?.content?.[0]?.text === 'ran contacts_list')
  check('the arguments were passed through', seen.some((s) => s.method === 'tools/call' && s.params?.arguments?.search === 'pat'))
  check('every hosted request carried the key as a bearer token', seen.length === 3 && seen.every((s) => s.auth === 'Bearer gbm_test_key'))
  check('and the negotiated protocol version', seen.every((s) => s.version === '2025-03-26'))
  check('a hosted protocol error keeps its code', r.byId.get(4)?.error?.code === -32602 && /Unknown tool/.test(r.byId.get(4)?.error?.message ?? ''))
  check('initialize is answered locally (nothing sent for it)', !seen.some((s) => s.method === 'initialize'))

  const wrong = await talk({ GROUNDBASE_API_KEY: 'gbm_wrong', GROUNDBASE_MCP_URL: url }, [
    init(), { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'contacts_list', arguments: {} } },
  ], 3)
  check('a refused key: tools/list says to check the key', /did not accept the API key/.test(wrong.byId.get(2)?.error?.message ?? ''))
  check('a refused key: the call fails readably', wrong.byId.get(3)?.result?.isError === true && /did not accept the API key/.test(wrong.byId.get(3)?.result?.content?.[0]?.text ?? ''))
  fake.close()

  const down = await talk({ GROUNDBASE_API_KEY: 'gbm_test_key', GROUNDBASE_MCP_URL: 'http://127.0.0.1:9/mcp' }, [
    init(), { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'contacts_list', arguments: {} } },
  ], 2)
  check('hosted server unreachable: the call fails readably', down.byId.get(3)?.result?.isError === true && /Could not reach Groundbase/.test(down.byId.get(3)?.result?.content?.[0]?.text ?? ''))
}

// ── the key never leaves over plain http to another machine ─────────────────
{
  const r = await talk({ GROUNDBASE_API_KEY: 'gbm_test_key', GROUNDBASE_MCP_URL: 'http://example.com/mcp' }, [init()], 0)
  check('a plain-http endpoint on another host: refuses to start', r.code === 1 && /must be an https URL/.test(r.stderr) && r.byId.size === 0)
}

if (failures.length) { for (const f of failures) console.error(`FAIL ${f}`); console.error(`${failures.length} failed, ${passed} passed`); process.exit(1) }
console.log(`groundbase-mcp bridge: ${passed} checks passed`)
