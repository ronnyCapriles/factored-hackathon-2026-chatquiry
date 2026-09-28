import type { Metadata } from "next";
import Forbidden from "../forbidden";

export const metadata: Metadata = { robots: { index: false } };

/** Target of the proxy's 403 rewrite. */
export default function Denied() {
  return <Forbidden />;
}
