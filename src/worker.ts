const ctx: Worker = self as any;

ctx.onmessage = ({ data }) => {
  console.log("Worker data: ", data);
};
