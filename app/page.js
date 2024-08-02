'use client'

import dynamic from 'next/dynamic'

import Canvas from './Canvas';

const Home = dynamic(() => import('./Canvas'), {
  ssr: false,
})

export default Home