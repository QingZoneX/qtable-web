# Optional registry mirrors are explicit build arguments, not required infrastructure.
ARG NODE_IMAGE=node:22-alpine
ARG NGINX_IMAGE=nginx:alpine

# ---- 构建阶段 ----
FROM ${NODE_IMAGE} AS build

WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmjs.org
ENV npm_config_registry=${NPM_REGISTRY}

COPY package.json package-lock.json .npmrc ./
# Install the locked JavaScript toolchain without package lifecycle scripts.
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY . .
RUN npm run build

# ---- 运行阶段 ----
FROM ${NGINX_IMAGE}

ARG QTABLE_UI_VERSION=0.0.0-dev
ARG QTABLE_UI_REVISION=unknown
ARG QTABLE_UI_CREATED=1970-01-01T00:00:00Z

LABEL org.opencontainers.image.title="QTableUI" \
      org.opencontainers.image.description="React frontend for the QTable AI-native multidimensional-table system" \
      org.opencontainers.image.source="https://github.com/QingZoneX/QTableUI" \
      org.opencontainers.image.url="https://github.com/QingZoneX/QTableUI" \
      org.opencontainers.image.documentation="https://github.com/QingZoneX/QTableUI#readme" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.version="${QTABLE_UI_VERSION}" \
      org.opencontainers.image.revision="${QTABLE_UI_REVISION}" \
      org.opencontainers.image.created="${QTABLE_UI_CREATED}"

# Rainbond 会为组件注入 PORT；默认值同时支持独立运行镜像。
# QTABLE_HOST / QTABLE_PORT 会由 QTable 组件的 QTABLE 端口别名自动注入。
# 默认值仅作兜底，实际值由自定义 entrypoint 在启动时读取环境变量决定。
ENV PORT=9100 \
    QTABLE_HOST=qtable \
    QTABLE_PORT=9000

COPY --from=build /app/dist /usr/share/nginx/html
COPY LICENSE NOTICE /usr/share/licenses/qtable-ui/
# 不放在 /etc/nginx/templates：官方镜像的 20-envsubst-on-templates.sh 会扫描
# 该目录。模板由下面的 25-render-config.sh 精确渲染，避免官方脚本的环境变量
# 过滤规则影响 ${PORT} 等变量。
COPY nginx.conf.template /opt/qtable-ui/nginx.conf.template
COPY nginx-security-headers.conf /etc/nginx/snippets/qtable-security-headers.conf
# 把脚本挂到 /docker-entrypoint.d/，由官方 /docker-entrypoint.sh 按数字序依次调用。
# 命名 25-* 让它在 20-envsubst-on-templates.sh 之后、30-tune-worker-processes.sh 之前跑。
COPY docker-entrypoint.sh /docker-entrypoint.d/25-render-config.sh
RUN chmod +x /docker-entrypoint.d/25-render-config.sh \
    && rm -f /etc/nginx/conf.d/default.conf

# 关键：删除官方镜像里的 20-envsubst-on-templates.sh。它会扫描 /etc/nginx/templates/
# 下的 *.template 并基于 NGINX_ENVSUBST_* 环境变量渲染。我们用更可靠的方式
# （精确白名单 envsubst 替换）自己渲染，所以不需要它。删除后即使它后续版本
# 改了语义也不会影响我们。
RUN rm -f /docker-entrypoint.d/20-envsubst-on-templates.sh \
    && test ! -e /docker-entrypoint.d/20-envsubst-on-templates.sh

# 不覆盖 ENTRYPOINT：保留官方 /docker-entrypoint.sh，让它处理 IPv6 / workers / 时区等，
# 然后在 /docker-entrypoint.d/ 依次调用我们的 25-render-config.sh。

EXPOSE 9100

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O - "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1 || exit 1
