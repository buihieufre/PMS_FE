import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Toaster } from 'sonner';
import { SidebarProvider } from '@/contexts/sidebarContext';
import { BoardBrandingProvider } from '@/contexts/boardBrandingContext';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <BoardBrandingProvider>
        <SidebarProvider>
          <Component {...pageProps} />
        </SidebarProvider>
      </BoardBrandingProvider>
      <Toaster 
        position="top-right" 
        expand={true} 
        richColors 
        closeButton
      />
    </>
  );
}
