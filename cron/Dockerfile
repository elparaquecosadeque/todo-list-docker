FROM postgres:16-alpine
COPY crontab /etc/crontabs/root
COPY cleanup.sh /cleanup.sh
RUN chmod +x /cleanup.sh
CMD ["crond", "-f", "-l", "2"]
