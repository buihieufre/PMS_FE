import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Toaster } from 'sonner';
import { SidebarProvider } from '@/contexts/sidebarContext';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <SidebarProvider>
        <Component {...pageProps} />
      </SidebarProvider>
      <Toaster 
        position="top-right" 
        expand={true} 
        richColors 
        closeButton
      />
    </>
  );
}
