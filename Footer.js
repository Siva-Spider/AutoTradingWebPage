// src/components/Footer.js
import React from "react";
import theme from "../theme";

function Footer() {
  return (
    <footer className={`p-4 mt-10 text-center ${theme.colors.secondary}`}>
      <p className={theme.text.body}>© 2025 Auto Trading Platform</p>
    </footer>
  );
}

export default Footer;
