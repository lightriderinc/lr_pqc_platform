'use client';

import LRButton from "@/components/ui/LRButton";

type Props = {
  onSignIn: () => Promise<void>;
};

const SignIn = ({ onSignIn }: Props) => {
  return (
    <LRButton
      type="button"
      variant="primary"
      onClick={() => {
        onSignIn();
      }}
    >
      Sign In
    </LRButton>
  );
};

export default SignIn;
