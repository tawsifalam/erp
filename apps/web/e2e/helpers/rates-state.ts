/** Rate plans and pricing quotes for Playwright PMS mocks. */

export type MockRateRule = {
  id: string;
  ratePlanId: string;
  dayOfWeek: number | null;
  minStayNights: number | null;
  pricePerNight: string | null;
};

export type MockRatePlan = {
  id: string;
  organizationId: string;
  roomTypeId: string;
  name: string;
  validFrom: string;
  validTo: string;
  baseModifier: string;
  isActive: boolean;
  roomType: { id: string; name: string };
  rules: MockRateRule[];
};

const INITIAL_PLANS: MockRatePlan[] = [
  {
    id: "rp_summer",
    organizationId: "org-test-001",
    roomTypeId: "rt_001",
    name: "Summer standard",
    validFrom: "2026-01-01T00:00:00Z",
    validTo: "2026-12-31T23:59:59Z",
    baseModifier: "1",
    isActive: true,
    roomType: { id: "rt_001", name: "Standard Double" },
    rules: [
      {
        id: "rr_weekend",
        ratePlanId: "rp_summer",
        dayOfWeek: 6,
        minStayNights: null,
        pricePerNight: "5000",
      },
    ],
  },
];

let ratePlans = structuredClone(INITIAL_PLANS) as MockRatePlan[];

export function resetRatesState() {
  ratePlans = structuredClone(INITIAL_PLANS) as MockRatePlan[];
}

export function getRatePlans() {
  return ratePlans.map((p) => ({ ...p, rules: p.rules.map((r) => ({ ...r })) }));
}

function countNights(checkIn: Date, checkOut: Date) {
  return Math.round((checkOut.getTime() - checkIn.getTime()) / (24 * 60 * 60 * 1000));
}

function eachNight(checkIn: Date, nights: number) {
  const dates: Date[] = [];
  for (let i = 0; i < nights; i++) {
    const d = new Date(checkIn);
    d.setUTCDate(d.getUTCDate() + i);
    dates.push(d);
  }
  return dates;
}

export function quoteStay(
  room: { basePrice: string; roomTypeId: string },
  checkIn: Date,
  checkOut: Date,
) {
  const nights = countNights(checkIn, checkOut);
  const nightDates = eachNight(checkIn, nights);
  const base = Number(room.basePrice);
  const plan = ratePlans.find(
    (p) =>
      p.isActive &&
      p.roomTypeId === room.roomTypeId &&
      new Date(p.validFrom) <= checkOut &&
      new Date(p.validTo) >= checkIn,
  );
  const modifier = plan ? Number(plan.baseModifier) : 1;
  const rules = plan?.rules ?? [];

  const nightlyBreakdown = nightDates.map((night) => {
    const dow = night.getUTCDay();
    const matching = rules.filter(
      (r) =>
        (r.dayOfWeek == null || r.dayOfWeek === dow) &&
        (r.minStayNights == null || r.minStayNights <= nights),
    );
    const specific = matching.filter((r) => r.dayOfWeek != null);
    const picked = specific[0] ?? matching[0];
    const amount =
      picked?.pricePerNight != null ? Number(picked.pricePerNight) : base * modifier;
    return { date: night.toISOString().slice(0, 10), amount };
  });

  const totalAmount = nightlyBreakdown.reduce((s, n) => s + n.amount, 0);
  return {
    totalAmount,
    nights,
    ratePlanId: plan?.id ?? null,
    ratePlanName: plan?.name ?? null,
    nightlyBreakdown,
  };
}

export function handleRatePlanMutation(
  method: string,
  url: string,
  body: Record<string, unknown> | null,
): unknown {
  if (method === "GET" && url.includes("/rate-plans") && !url.includes("/rules")) {
    return getRatePlans();
  }

  const planIdMatch = url.match(/\/rate-plans\/([^/?]+)/);
  const planId = planIdMatch?.[1];

  if (method === "POST" && url.includes("/rules") && planId) {
    const plan = ratePlans.find((p) => p.id === planId);
    if (!plan) return { status: 404, message: "Rate plan not found" };
    const rule: MockRateRule = {
      id: `rr_${plan.rules.length + 1}`,
      ratePlanId: planId,
      dayOfWeek: body?.dayOfWeek != null ? Number(body.dayOfWeek) : null,
      minStayNights: body?.minStayNights != null ? Number(body.minStayNights) : null,
      pricePerNight: body?.pricePerNight != null ? String(body.pricePerNight) : null,
    };
    plan.rules.push(rule);
    return rule;
  }

  const ruleDelete = url.match(/\/rate-plans\/([^/]+)\/rules\/([^/?]+)/);
  if (method === "DELETE" && ruleDelete) {
    const [, pid, rid] = ruleDelete;
    const plan = ratePlans.find((p) => p.id === pid);
    if (!plan) return { status: 404, message: "Rate plan not found" };
    plan.rules = plan.rules.filter((r) => r.id !== rid);
    return { deleted: true, id: rid };
  }

  if (method === "POST" && url.includes("/rate-plans") && !url.includes("/rules")) {
    const plan: MockRatePlan = {
      id: `rp_${ratePlans.length + 1}`,
      organizationId: "org-test-001",
      roomTypeId: String(body?.roomTypeId ?? "rt_001"),
      name: String(body?.name ?? "New plan"),
      validFrom: String(body?.validFrom ?? "2026-01-01"),
      validTo: String(body?.validTo ?? "2026-12-31"),
      baseModifier: String(body?.baseModifier ?? "1"),
      isActive: body?.isActive !== false,
      roomType: {
        id: String(body?.roomTypeId ?? "rt_001"),
        name: "Standard Double",
      },
      rules: [],
    };
    ratePlans.push(plan);
    return plan;
  }

  if (method === "DELETE" && planId) {
    ratePlans = ratePlans.filter((p) => p.id !== planId);
    return { deleted: true, id: planId };
  }

  if (method === "PATCH" && planId && body) {
    const plan = ratePlans.find((p) => p.id === planId);
    if (!plan) return { status: 404, message: "Rate plan not found" };
    if (body.name) plan.name = String(body.name);
    if (body.validFrom) plan.validFrom = String(body.validFrom);
    if (body.validTo) plan.validTo = String(body.validTo);
    if (body.baseModifier != null) plan.baseModifier = String(body.baseModifier);
    if (body.isActive !== undefined) plan.isActive = Boolean(body.isActive);
    return plan;
  }

  return {};
}
