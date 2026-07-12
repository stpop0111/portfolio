import type { Metadata } from 'next';
import './globals.css';
import LenisWrapper from './_components/LenisWrapper';
import CustomCursor from './_components/CustomCursor'
import Script from 'next/script';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' className={`h-full antialiased`}>
      <body className='min-h-full flex flex-col'>
        <Script id='adobe-fonts' strategy='beforeInteractive'>
          {` (function(d) { var config = { kitId: 'dke3pds', scriptTimeout: 3000, async: true }, h=d.documentElement,t=setTimeout(function(){h.className=h.className.replace(/\\bwf-loading\\b/g,"")+" wf-inactive";},config.scriptTimeout),tk=d.createElement("script"),f=false,s=d.getElementsByTagName("script")[0],a;h.className+=" wf-loading";tk.src='https://use.typekit.net/'+config.kitId+'.js';tk.async=true;tk.onload=tk.onreadystatechange=function(){a=this.readyState;if(f||a&&a!="complete"&&a!="loaded")return;f=true;clearTimeout(t);try{Typekit.load(config)}catch(e){}};s.parentNode.insertBefore(tk,s) })(document); `}
        </Script>
        <LenisWrapper>{children}
          <CustomCursor />
        </LenisWrapper>
      </body>
    </html>
  );
}
