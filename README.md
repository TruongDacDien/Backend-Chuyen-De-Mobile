<p align="center">
  <strong>ĐẠI HỌC QUỐC GIA THÀNH PHỐ HỒ CHÍ MINH</strong><br/>
  <strong>TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN</strong>
</p>

<p align="center">
  <strong>BÁO CÁO CHUYÊN ĐỀ MOBILE AND PERVASIVE COMPUTING</strong><br/>
  <strong>ĐỀ TÀI</strong><br/>
  <span style="color:#c00000"><strong>ỨNG DỤNG CHẤM CÔNG BẰNG NHẬN DIỆN KHUÔN MẶT</strong></span>
</p>

<p align="center">
  <img src="https://tse3.mm.bing.net/th/id/OIP.o4oXRVly8XAYrPIodBZZ0AHaI2?pid=Api&P=0&h=220" alt="UIT logo" width="200"/>
</p>

**Giảng viên hướng dẫn:** Nguyễn Tấn Toàn  
**Lớp:** SE405.Q11  
**Môn học:** Chuyên đề Mobile and Pervasive Computing  
**Sinh viên thực hiện:**

- Trần Ngọc Phú - 22521107
- Lê Quang Phúc - 22521118
- Trương Đắc Điền - 22520248
- Nguyễn Công Thành - 22521351

<p align="center"><strong>TP. Hồ Chí Minh, 2025</strong></p>

---

# TimeFace – Hướng dẫn setup môi trường

Dự án dùng React Native CLI (React Native 0.78, React 19) và `npm` (đi kèm `package-lock.json`). Làm theo các bước dưới để chuẩn bị môi trường và chạy ứng dụng.

## 1. Yêu cầu hệ thống

- Node.js ≥ 18 (khuyến nghị cài bằng nvm để dễ đổi phiên bản).
- npm 10+ (tránh trộn Yarn để giữ đồng bộ `package-lock.json`).
- JDK 17 và Android Studio (Ladybug/Koala) với SDK 35: Build Tools 35.0.0, Platform API 35, Platform-Tools, NDK 27.1.12297006, một emulator API 35.
- macOS (nếu build iOS): Xcode 15+, CocoaPods ≥ 1.13, Ruby ≥ 2.6.10 (theo `Gemfile`), Bundler.
- Công cụ hỗ trợ: Git, Watchman (macOS) để Metro ổn định.

## 2. Chuẩn bị mã nguồn

```sh
git clone <url_repo>
cd TimeFace
npm install
```

## 3. Thiết lập Android

- Mở Android Studio → SDK Manager và cài:
  - Android 14 (API 35) SDK Platform.
  - Android SDK Build-Tools 35.0.0.
  - Android SDK Platform-Tools.
  - NDK 27.1.12297006 (khớp với cấu hình Gradle).
- Cấu hình biến môi trường SDK:
  - macOS/Linux:  
    `export ANDROID_HOME=$HOME/Library/Android/sdk` (macOS) hoặc `$HOME/Android/Sdk` (Linux)  
    `export PATH=$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH`
  - Windows: `ANDROID_HOME=%LOCALAPPDATA%\\Android\\Sdk` và thêm `%ANDROID_HOME%\\platform-tools` vào PATH.
- Khởi động emulator API 35 hoặc cắm thiết bị (bật USB debugging) trước khi chạy lệnh.

## 4. Thiết lập iOS (chỉ macOS)

```sh
cd ios
bundle install
bundle exec pod install
cd ..
```

- Nếu thiếu CocoaPods/Bundler: `sudo gem install bundler cocoapods` (đảm bảo Ruby ≥ 2.6.10).
- Có thể mở `ios/GokuuNe.xcworkspace` trong Xcode để chọn team ký và chạy thủ công.

## 5. Chạy ứng dụng

Terminal 1 (Metro):

```sh
npm start
```

Terminal 2:

```sh
# Android
npm run android

# iOS (sau khi pod install, simulator đang chạy)
npm run ios
```

- Build APK: `npm run build:android:debug` hoặc `npm run build:android:release` (cần keystore riêng cho bản phát hành).

## 6. Kiểm tra chất lượng

```sh
npm run lint
npm run typecheck
npm test
```

## 7. Ghi chú & xử lý sự cố nhanh

- Metro lỗi cache: `npm start -- --reset-cache`.
- Android build lỗi: `cd android && ./gradlew clean` rồi chạy lại.
- iOS cache: `watchman watch-del-all && rm -rf ~/Library/Developer/Xcode/DerivedData`.
- Ứng dụng dùng camera (react-native-vision-camera): nhớ cấp quyền camera/micro cho thiết bị hoặc emulator.
