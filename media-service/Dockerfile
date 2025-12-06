# Sử dụng base image Java
FROM eclipse-temurin:17-jdk-alpine

# Set working directory
WORKDIR /app

# Copy file jar sau khi build vào container
# Lưu ý: Cần chạy 'mvn clean package' trước khi build docker
COPY target/media-service-0.0.1-SNAPSHOT.jar app.jar

# Expose port
EXPOSE 8083

# Chạy ứng dụng
ENTRYPOINT ["java", "-jar", "app.jar"]