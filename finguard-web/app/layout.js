import "./globals.css";
import Chatbot from "@/components/Chatbot";

export const metadata = {
  title: "FinGuard AI",
  description: "Financial fraud detection and risk analytics",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}<Chatbot /></body>
    </html>
  );
}
