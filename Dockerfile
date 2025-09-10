# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

# 安装构建依赖
RUN apk add --no-cache python3 make g++

# 复制依赖文件
COPY package.json yarn.lock ./

# 安装所有依赖（包括devDependencies）
RUN yarn install --frozen-lockfile

# 复制源代码
COPY . .

# 构建应用
RUN yarn build

# 生产阶段
FROM node:18-alpine AS production

WORKDIR /app

# 安装运行时依赖
RUN apk add --no-cache dumb-init

# 复制package.json和yarn.lock
COPY package.json yarn.lock ./

# 只安装生产依赖
RUN yarn install --frozen-lockfile --production && \
    yarn cache clean

# 从构建阶段复制构建产物
COPY --from=builder /app/dist ./dist



# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/xrpc/app.bsky.feed.describeFeedGenerator', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# 使用dumb-init作为PID 1
ENTRYPOINT ["dumb-init", "--"]

# 启动应用
CMD ["node", "dist/index.js"]