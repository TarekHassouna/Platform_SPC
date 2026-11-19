import { TeacherStoreProvider } from "@/lib/teacher-store";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return <TeacherStoreProvider>{children}</TeacherStoreProvider>;
}
