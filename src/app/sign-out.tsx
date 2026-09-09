'use client';

import LRButton from "@/components/ui/LRButton";
import { MdLogout } from "react-icons/md";

type Props = {
  onSignOut: () => Promise<void>;
};

const SignOut = ({ onSignOut }: Props) => {
  return (
    <LRButton
      type="button"
      variant="secondary"
      icon={<MdLogout className="text-lg" />}
      iconPosition="left"
      onClick={() => {
        onSignOut();
      }}
    >
      Sign Out
    </LRButton>
  );
};

export default SignOut;
