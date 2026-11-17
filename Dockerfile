# The local (stdio) bridge to the hosted Groundbase MCP server.
# No dependencies to install: three files and Node.
#
#   docker build -t groundbase-mcp .
#   docker run -i --rm -e GROUNDBASE_API_KEY=gbm_your_key_here groundbase-mcp
#
# Without GROUNDBASE_API_KEY it still starts and lists its tools; tool calls
# answer "no key set".
FROM node:22-alpine
WORKDIR /app
COPY package.json server.mjs tools.json ./
USER node
ENTRYPOINT ["node", "server.mjs"]
