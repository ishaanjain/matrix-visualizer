'use client'

import styles from './page.module.css';
import dynamic from 'next/dynamic'

import Canvas from './Canvas';

const Home = dynamic(() => import('./Canvas'), {
  ssr: false,
})

export default Home