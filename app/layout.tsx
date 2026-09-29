import type { Metadata } from 'next';
import './globals.css';
const siteTitle = '524のお友達メーカー';
const siteDescription = '3文字の目と、いろんなかたちと色。あなただけの524のお友達をつくって、画像やコードで持ち帰ろう。';
const siteUrl = 'https://friends-of-524.pages.dev/';
const ogImage = '/og-image.png';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  icons: { icon: { url: '/assets/524-logo-v1.png', type: 'image/png' } },
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: siteTitle,
    locale: 'ja_JP',
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: ogImage,
        width: 1734,
        height: 907,
        alt: '524のお友達メーカー。さまざまな数字の目をしたお友達が並ぶ。',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
    images: [ogImage],
  },
};

export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ja"><body>{children}</body></html>;}
