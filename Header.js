
import React from "react";
import theme from "../theme";

function Header() {
  return (
    <header className={`p-6 shadow-md ${theme.colors.background}`}>
      <h1 className={`${theme.text.heading} ${theme.colors.primary}`}>
        🚀 Auto Trading Dashboard
      </h1>
    </header>
  );
}

export default Header;
