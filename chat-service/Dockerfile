# Dùng OpenJDK 17 (giống các service kia)
FROM eclipse-temurin:17-jdk-alpine

# Thư mục làm việc trong container
WORKDIR /app

# Copy file .jar sau khi build vào container
COPY target/*.jar app.jar

# Lệnh chạy ứng dụng
ENTRYPOINT ["java","-jar","app.jar"]