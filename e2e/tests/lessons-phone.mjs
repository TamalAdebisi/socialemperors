// The entire mandatory tutorial must be playable with touch controls.
import lessons from "./lessons.mjs";
export default async function lessonsPhone(context) {
  await lessons({ ...context, phone: true });
}
