export interface RegisterForm {
  full_name: string;
  email: string;
  gender: "1" | "2"; // 後端只接受 1=男 2=女
  password: string;
  confirmPassword: string; // 前端自加，用來比對
}

export interface User {
  id: number;
  full_name: string;
  email: string;
  gender: "1" | "2";
  status: 0 | 1;
  create_time: number;
  last_edit_time: number;
}
