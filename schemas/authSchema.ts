import { z } from "zod";

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\W).{8,}$/;
const emailPattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export const registerSchema = z
  .object({
    full_name: z.string().min(1, "請填寫姓名"),
    email: z.string().regex(emailPattern, "Email 格式錯誤"),
    gender: z.enum(["1", "2"], { message: "請選擇性別" }),
    password: z
      .string()
      .regex(passwordPattern, "密碼至少8碼，需含大小寫字母＋特殊符號"),
    confirmPassword: z.string(),
    ageConfirmed: z.boolean().refine((val) => val === true, {
      message: "您必須年滿18歲才能註冊",
    }),
    termsConfirmed: z.boolean().refine((val) => val === true, {
      message: "您必須同意免責聲明",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "兩次密碼不一致",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().email("Email 格式錯誤"),
  password: z
    .string()
    .regex(passwordPattern, "密碼格式錯誤（至少8碼，需含大小寫＋特殊符號）"),
});

// 推導出 TypeScript 型別（之後所有表單都用這個）
export type RegisterForm = z.infer<typeof registerSchema>;
