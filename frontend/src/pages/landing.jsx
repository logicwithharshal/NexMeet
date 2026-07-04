import React from "react";
import "../App.css";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@mui/material";

export default function LandingPage() {
  const router = useNavigate();

  return (
    <div className="LandingPageContainer">
      <nav>
        <div className="navHeader">
          <h2>My Video Call</h2>
        </div>
        <div className="navlist">
          <p onClick={() => {
              // window.location.href = "/q23qsc";
              router("/q23qsc");
            }}>
            Join as Guest
          </p>
          <p onClick={() => {
              router("/auth");
            }}>
            Log In
          </p>
          <p onClick={() => {
            router("/auth", { state: { isRegister: true } });
            }}>
            Sign Up
          </p>
        </div>
      </nav>
      <div className="landingMainContainer">
        <div>
          <h1>
            <span style={{ color: "orange" }}>Connect</span> with your Loved
            Ones
          </h1>
          <p>Cover a distance by My Video Call</p>
          <div role="button">
            <Link to={"/auth"}>Get Started</Link>
          </div>
        </div>
        <div>
          <img src="/mobile.png" alt="mobile"></img>
        </div>
      </div>
    </div>
  );
}
