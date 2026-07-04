import React, { useState, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext";
// import { useNavigate } from "react-router-dom";
import "../styles/authentication.css";

export default function Authentication() {
    const location = useLocation();
    const [isActive, setIsActive] = useState(location.state?.isRegister || false);

    // Sign In state
    const [loginUsername, setLoginUsername] = useState("");
    const [loginPassword, setLoginPassword] = useState("");

    // Sign Up state
    const [registerName, setRegisterName] = useState("");
    const [registerUsername, setRegisterUsername] = useState("");
    const [registerPassword, setRegisterPassword] = useState("");

    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const { handleLogin, handleRegister } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setError("");
        try {
            await handleLogin(loginUsername, loginPassword);
            navigate("/home");
        } catch (err) {
            setError(err.response?.data?.message || "Login failed");
        }
    };

    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        setError("");
        try {
            const result = await handleRegister(registerName, registerUsername, registerPassword);
            setMessage(result);
            setIsActive(false); // switch to login panel
            setRegisterName("");
            setRegisterUsername("");
            setRegisterPassword("");
        } catch (err) {
            setError(err.response?.data?.message || "Registration failed");
        }
    };

    return (
        <div className="auth-body">
            <div className={`auth-container ${isActive ? "active" : ""}`}>

                {/* Sign Up Form */}
                <div className="auth-form-container sign-up">
                    <form onSubmit={handleRegisterSubmit}>
                        <h1>Create Account</h1>
                        <div className="social-icons">
                            <a href="#" className="icon"><i className="fa-brands fa-google-plus-g"></i></a>
                            <a href="#" className="icon"><i className="fa-brands fa-facebook-f"></i></a>
                            <a href="#" className="icon"><i className="fa-brands fa-github"></i></a>
                            <a href="#" className="icon"><i className="fa-brands fa-linkedin-in"></i></a>
                        </div>
                        <span>or use your email for registration</span>
                        <input
                            type="text"
                            placeholder="Name"
                            value={registerName}
                            onChange={e => setRegisterName(e.target.value)}
                            required
                        />
                        <input
                            type="text"
                            placeholder="Username"
                            value={registerUsername}
                            onChange={e => setRegisterUsername(e.target.value)}
                            required
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={registerPassword}
                            onChange={e => setRegisterPassword(e.target.value)}
                            required
                        />
                        {error && <p style={{color:"red", fontSize:"12px"}}>{error}</p>}
                        {message && <p style={{color:"green", fontSize:"12px"}}>{message}</p>}
                        <button type="submit">Sign Up</button>
                    </form>
                </div>

                {/* Sign In Form */}
                <div className="auth-form-container sign-in">
                    <form onSubmit={handleLoginSubmit}>
                        <h1>Log In</h1>
                        <div className="social-icons">
                            <a href="#" className="icon"><i className="fa-brands fa-google-plus-g"></i></a>
                            <a href="#" className="icon"><i className="fa-brands fa-facebook-f"></i></a>
                            <a href="#" className="icon"><i className="fa-brands fa-github"></i></a>
                            <a href="#" className="icon"><i className="fa-brands fa-linkedin-in"></i></a>
                        </div>
                        <span>or use your username and password</span>
                        <input
                            type="text"
                            placeholder="Username"
                            value={loginUsername}
                            onChange={e => setLoginUsername(e.target.value)}
                            required
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={loginPassword}
                            onChange={e => setLoginPassword(e.target.value)}
                            required
                        />
                        <a href="#">Forget Your Password?</a>
                        {error && <p style={{color:"red", fontSize:"12px"}}>{error}</p>}
                        <button type="submit">Log In</button>
                    </form>
                </div>

                {/* Toggle Panel */}
                <div className="toggle-container">
                    <div className="toggle">
                        <div className="toggle-panel toggle-left">
                            <h1>Welcome Back!</h1>
                            <p>Enter your personal details to use all of site features</p>
                            <button className="hidden" onClick={() => setIsActive(false)}>Log In</button>
                        </div>
                        <div className="toggle-panel toggle-right">
                            <h1>Hello, Friend!</h1>
                            <p>Register with your personal details to use all of site features</p>
                            <button className="hidden" onClick={() => setIsActive(true)}>Sign Up</button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}