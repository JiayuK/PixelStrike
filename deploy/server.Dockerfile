FROM scratch
WORKDIR /app
COPY --chmod=755 release/pixelstrike ./pixelstrike
COPY map.json ./map.json
ENV PORT=8080 DB_PATH=/data/stats.db MAP_PATH=/app/map.json
VOLUME ["/data"]
EXPOSE 8080
ENTRYPOINT ["/app/pixelstrike"]
