RUN apt-get update && apt-get install -y \
    fontconfig \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*