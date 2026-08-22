import type { SVGProps } from "react"

// OpenCode's mark (svgl.app), reduced to its block outline so it inherits the text colour
// the way the OpenAI mark does; the filled background squares belong to their app icon only.
const Opencode = (props: SVGProps<SVGSVGElement>) => (
  <svg {...props} preserveAspectRatio="xMidYMid" viewBox="0 0 512 512">
    <title>OpenCode</title>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M384 416H128V96H384V416ZM320 160H192V352H320V160Z"
    />
  </svg>
)

export { Opencode }
