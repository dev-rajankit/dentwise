import { Button } from "@/components/ui/button";
import { SignUpButton } from "@clerk/nextjs";
import Image from "next/image";

export default function Home() {
  return <div>
    <h1>
      <SignUpButton>SignUp</SignUpButton>
    </h1>
  </div>;
}
