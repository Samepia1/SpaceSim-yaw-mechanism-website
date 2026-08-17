import dynamic from 'next/dynamic';
import ScrubSequence from '@/components/ScrubSequence';
import Clip from '@/components/Clip';
import manifest from '@/public/frames/manifest.json';
import styles from './page.module.css';

// three.js is large and only needed once a viewer is on screen, so it stays out
// of the initial bundle entirely.
const ModelViewer = dynamic(() => import('@/components/ModelViewer'));

const frames = manifest as Record<string, { count: number }>;

export default function Home() {
  return (
    <main>
      {/* ------------------------------- hero ------------------------------- */}
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <p className="eyebrow">ARDC Lab · University of Minnesota</p>
          <h1>
            Rotating a cable robot&rsquo;s payload
            <br />
            without tangling its cables
          </h1>
          <p className="lede">
            A cable-driven parallel robot positions its payload with cables. Turn the
            payload and those cables converge on each other, so yaw runs out
            long before the workspace does. This is the mechanism that removes that
            limit, from bench prototype to full scale.
          </p>
          <ul className="specs">
            <li>
              <b>30&ndash;40°</b>
              <span>yaw before the cables collide</span>
            </li>
            <li>
              <b>360°</b>
              <span>continuous, with the mechanism</span>
            </li>
          </ul>
          <p className={styles.scrollCue} aria-hidden>
            scroll
          </p>
        </div>
      </header>

      {/* --------------------------- the prototype -------------------------- */}
      <ScrubSequence
        name="prototype"
        count={frames.prototype?.count ?? 120}
        scrollLength={3}
        alt="The bench prototype's yaw mechanism rotating inside the payload frame"
      >
        <div className={styles.overlay}>
          <p className="eyebrow">The prototype</p>
          <h2>A planetary yaw drive inside the payload frame</h2>
        </div>
      </ScrubSequence>

      <section className="section">
        <div className="split">
          <div>
            <p className="eyebrow">The Initial Idea</p>
            <h2>The Main Consideration: Continuous Rotation</h2>
            <p>
              The first build put a planetary yaw drive under the payload frame,
              and a magnetic encoder on the yaw axis itself rather than on the motor,
              so the controller reads the angle that matters for the closed-loop-control.
            </p>
            <p>
              It was modelled with true mass and inertia properties, which meant the
              bench article behaved like the real payload rather than like a
              lightweight mock-up.
            </p>
            <ul className="specs">
              <li>
                <b>3:1</b>
                <span>planetary reduction (36/12)</span>
              </li>
              <li>
                <b>360°</b>
                <span>continuous rotation</span>
              </li>
              <li>
                <b>10 kg</b>
                <span>payload, limited by 3D-printed parts</span>
              </li>
            </ul>
          </div>
          <div className="sticky">
            <ModelViewer
              url="/models/prototype.glb"
              label="Prototype assembly"
              spread={0.55}
            />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="split">
          <div>
            <p className="eyebrow">On the robot</p>
            <h2>It exists, and it turns</h2>
            <p>
              Filmed on the lab&rsquo;s cable-driven parallel robot.
            </p>
          </div>
          <Clip
            name="lab"
            webm
            caption="The assembled prototype on the ARDC Lab CDPR."
          />
        </div>
      </section>

      <hr className="rule" />

      {/* --------------------------- full scale ----------------------------- */}
      <section className="section">
        <div className="split">
          <div>
            <p className="eyebrow">Scaling up</p>
            <h2>The version that could actually be afforded</h2>
            <p>
              Scaling the prototype meant machining almost every part. The redesign
              replaced the custom gearbox and machined holders with off-the-shelf
              gears, pillow-block bearings and extrusion. Now we have exactly one
              custom part, the shaft-to-payload attachment.
            </p>
            <ul className="specs">
              <li>
                <b>&darr;65%</b>
                <span>cost, $1500&ndash;2000 to $500&ndash;700</span>
              </li>
              <li>
                <b>7 &rarr; 1</b>
                <span>custom parts</span>
              </li>
              <li>
                <b>5:1</b>
                <span>reduction, up from 3:1</span>
              </li>
              <li>
                <b>50 kg</b>
                <span>payload, up from 10 kg</span>
              </li>
            </ul>
            <p className={styles.note}>Drag the slider to pull the assembly apart.</p>
          </div>
          <div className="sticky">
            <ModelViewer
              url="/models/fullscale.glb"
              label="Full-scale assembly"
              spread={0.65}
            />
          </div>
        </div>
      </section>

      {/* --------------------------- assembly scrub ------------------------- */}
      <ScrubSequence
        name="assembly"
        count={frames.assembly?.count ?? 140}
        scrollLength={4}
        alt="The full-scale mechanism assembling, ending on the shaft and gear detail"
      >
        <div className={styles.overlay}>
          <p className="eyebrow">How it goes together</p>
          <h2>Stock gears, pillow-block bearings, one custom part</h2>
        </div>
      </ScrubSequence>

      <section className="section">
        <div className="split">
          <div>
            <p className="eyebrow">Full-scale walkthrough</p>
            <h2>The finished design</h2>
            <p>
              A pass over the full-scale payload: the 1&nbsp;inch 1144 carbon-steel
              shaft, the carbon-steel gear pair, the bearing pillow mounts, and the
              ODrive motor that drives it all.
            </p>
          </div>
          <Clip
            name="fullscale-demo"
            caption="Full-scale design walkthrough. Captions are rendered into the clip."
          />
        </div>
      </section>

      {/* ------------------------------ footer ------------------------------ */}
      <footer className={styles.footer}>
        <div className="wide">
          <p className={styles.footerLede}>
            Summer research project, <strong>ARDC Lab</strong> &mdash; Aerospace,
            Robotics, Dynamics &amp; Control, University of Minnesota.
          </p>
          <dl className={styles.meta}>
            <div>
              <dt>Built by</dt>
              <dd>Samvel Kerobyan</dd>
            </div>
            <div>
              <dt>Advisor</dt>
              <dd>Prof. Ryan J. Caverly</dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd>
                <a href="mailto:kerob002@umn.edu">kerob002@umn.edu</a>
              </dd>
            </div>
            <div>
              <dt>Lab</dt>
              <dd>
                <a href="https://z.umn.edu/ARDCLab">z.umn.edu/ARDCLab</a>
              </dd>
            </div>
          </dl>
        </div>
      </footer>
    </main>
  );
}
