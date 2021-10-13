/* eslint-disable @typescript-eslint/no-explicit-any */
export default function countOutline(outline: any[]) {
  outline.reduce((acc, curr) => {
    if (curr.children === undefined) {
      return acc + 1;
    }

    return acc + countOutline(curr.children) + 1;
  }, 0);
}
