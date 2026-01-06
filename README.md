# AI Young Guru Photo Booth

Ứng dụng Photo Booth tích hợp AI Gemini và Firebase.

## Hướng dẫn Deploy lên Vercel

1. **Đẩy code lên GitHub**:
   - Tạo repo mới trên GitHub.
   - Chạy lệnh:
     ```bash
     git init
     git add .
     git commit -m "Initial commit"
     git branch -M main
     git remote add origin <URL_REPO_CỦA_BẠN>
     git push -u origin main
     ```

2. **Kết nối với Vercel**:
   - Vào [Vercel Dashboard](https://vercel.com/dashboard).
   - Chọn **Add New...** -> **Project**.
   - Chọn repo GitHub bạn vừa tạo.

3. **Cấu hình Biến Môi Trường (Environment Variables)**:
   - Trong phần **Environment Variables** trên Vercel, bạn CẦN thêm key sau:
     - `API_KEY`: Điền API Key Google Gemini của bạn vào đây.

4. **Deploy**:
   - Nhấn **Deploy**.
   - Vercel sẽ tự động nhận diện đây là dự án Vite và tiến hành build.

## Cài đặt Local

1. `npm install`
2. Tạo file `.env` và thêm `API_KEY=your_key_here`
3. `npm run dev`
