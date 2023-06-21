import styles from './page.module.css';
import dynamic from 'next/dynamic'

const Home = dynamic(() => import('./Canvas'), {
  ssr: false,
})

export default Home