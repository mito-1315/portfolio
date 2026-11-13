
import "./About.css";

function About() {
  return (
    <section className="about-section page-container" id="about">
      <div className="about-heading">
        <span className="section-label">A LITTLE ABOUT ME</span>

        <h2>
          Curious by nature.
          <br />
          <span>A builder by choice.</span>
        </h2>
      </div>

      <div className="about-body">
        <p>
          I'm Mithesh Tharun S — a developer who enjoys turning
          ideas into things people can actually use.
        </p>

        <p>
          My interests sit somewhere between full-stack development,
          intelligent systems and creative experimentation. I like
          understanding how things work, exploring unfamiliar
          technologies and bringing different pieces together to
          build something meaningful.
        </p>

        <p>
          For me, development isn't just about writing code.
          It's about curiosity, problem-solving and the satisfaction
          of making an idea real.
        </p>
      </div>

      <div className="about-details">
        <div>
          <span>01 / CURRENTLY EXPLORING</span>
          <p>Full-stack development & AI</p>
        </div>

        <div>
          <span>02 / INTERESTED IN</span>
          <p>Creative technology</p>
        </div>

        <div>
          <span>03 / BASED IN</span>
          <p>Chennai, India</p>
        </div>
      </div>
    </section>
  );
}

export default About;
