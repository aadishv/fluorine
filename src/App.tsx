"use client";
import "./index.css";
import ProviderWrapper from "./components/ProviderWrapper";
import { Switch, Route, Redirect, Link } from "wouter";

import { Button } from "./components/ui/button";
import { useAuthActions } from "@convex-dev/auth/react";
import api from "./cvx";
import { useQuery } from "convex/react";
import { useState, useEffect } from "react";
import FactChecker from "./components/FactChecker";

function NotFound() {
  const [count, setCount] = useState(3);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    if (count === 0) {
      setShouldRedirect(true);
      return;
    }
    const timer = setTimeout(() => setCount(count - 1), 1000);
    return () => clearTimeout(timer);
  }, [count]);

  if (shouldRedirect) {
    return <Redirect to="/" />;
  }

  return (
    <div className="flex flex-col items-center justify-center h-[40vh]">
      <h1 className="font-serif text-4xl mb-4">404: Not Found</h1>
      <p className="font-sans text-lg mb-2">
        Redirecting to home in <span className="font-bold">{count}</span>...
      </p>
      <p className="font-sans text-sm text-gray-500">
        If you are not redirected,{" "}
        <Link href="/" className="underline">
          click here
        </Link>
        .
      </p>
    </div>
  );
}

function App() {
  const userQuery = useQuery(api.authFunctions.getUser);
  const { signOut } = useAuthActions();

  const { viewer, image } = userQuery ?? {};

  return (
    <ProviderWrapper>
      <div className="top-0 right-0 h-15  z-50 w-full fixed px-2 py-2 flex gap-5">
        <span className="font-serif my-auto ml-2 mr-auto text-3xl">
          Fluorine
        </span>
        <div className="flex">
          {image && (
            <img
              src={image}
              className="w-7 h-7 rounded-full my-auto"
              alt="Profile"
            />
          )}
          <p className="ml-2 my-auto">{viewer ?? "Anonymous"}</p>
        </div>
        <Button
          variant="secondary"
          className="my-auto"
          onClick={() => void signOut()}
        >
          Sign out
        </Button>
      </div>
      <div className="mt-15">
        <Switch>
          <Route path="/">
            <FactChecker />
          </Route>
          <Route>
            <NotFound />
          </Route>
        </Switch>
      </div>
    </ProviderWrapper>
  );
}

export default App;
