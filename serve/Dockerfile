# 使用Node.js官方镜像
FROM node:latest

# 设置工作目录
WORKDIR /usr/src/app


# 复制package.json和package-lock.json
COPY package*.json ./


# 安装依赖
RUN npm install


# 复制项目文件
COPY . .

# 应用监听的端口
EXPOSE 3000

# 启动命令
CMD ["node", "app.js"]
