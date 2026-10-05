import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <header className={styles.intro}>
        <p className="eyebrow">University of Minnesota</p>
        <h1>Samvel Kerobyan</h1>
        <p className="lede">Engineering projects: mechanisms, robotics and aerodynamics.</p>
      </header>

      <ul className={styles.projects}>
        <li>
          <Link href="/Yaw_Mechanism" className={styles.card}>
            <span className={styles.tag}>ARDC Lab</span>
            <h2>Independent yaw mechanism</h2>
            <p>
              Continuous payload rotation for a cable-driven parallel robot, from bench
              prototype to full scale. Interactive 3D models and animations.
            </p>
            <span className={styles.go}>View project &rarr;</span>
          </Link>
        </li>
        <li>
          {/* A plain anchor: the dashboard is a static page outside the Next app,
              so client-side navigation would not find a route for it. */}
          <a href="/FSAE/Aero-data" className={styles.card}>
            <span className={styles.tag}>Minnesota FSAE</span>
            <h2>FSAE aero data explorer</h2>
            <p>
              Wind-tunnel measurements and CFD predictions for the car&rsquo;s aerodynamic
              configurations, side by side.
            </p>
            <span className={styles.go}>Open dashboard &rarr;</span>
          </a>
        </li>
      </ul>
    </main>
  );
}
