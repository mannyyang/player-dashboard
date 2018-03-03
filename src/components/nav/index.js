import { h } from "preact";
import "./style.scss";
import If from "../utils/condition-component";

const Nav = ({
  name = "",
  version = "NaN",
  makers = { name: "", email: "", url: "" },
  onBuildClick = () => {}
}) => {
  const emailLink = (
    <If
      condition={makers.email}
      then={
        <a href={`mailto:${makers.email}`} className="nav-link">
          {makers.email}
        </a>
      }
    />
  );

  const webLink = (
    <If
      condition={makers.url}
      then={
        <a target="_blank" href={makers.url} className="nav-link">
          {makers.url}
        </a>
      }
    />
  );

  return (
    <ul className="nav">
      <li className="project">{name}</li>
      <li className="version">{version}</li>
      <li className="makers">
        <span>{makers.name}</span>
        {emailLink}
        {webLink}
      </li>
      <li className="build-button">
        <button onClick={onBuildClick} class="button primary" type="button">
          Build for Production
        </button>
      </li>
    </ul>
  );
};

export default Nav;
