import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'524のお友達メーカー',description:'3文字の目と、いろんなかたちと色。あなただけの524のお友達をつくって、画像やコードで持ち帰ろう。',icons:{icon:{url:'/assets/524-logo-v1.png',type:'image/png'}}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ja"><body>{children}</body></html>;}
