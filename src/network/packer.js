const ucPacker = {
  $: "Union",
  variants: {
    king: { $: "Struct", fields: {} },
    chef: { $: "Struct", fields: {} },
    guard: { $: "Struct", fields: {} },
    dummy: { $: "Struct", fields: {} },
  },
};

const uePacker = {
  $: "Union",
  variants: {
    assassin: { $: "Struct", fields: {} },
    spy: { $: "Struct", fields: {} },
    invader: { $: "Struct", fields: {} },
    tribute: { $: "Struct", fields: {} },
    poisoned_tribute: { $: "Struct", fields: {} },
  },
};

const actionPacker = {
  $: "Union",
  variants: {
    menu: { $: "Struct", fields: {} },
    restart: { $: "Struct", fields: {} },
  },
};

export const packer = {
  $: "Union",
  variants: {
    join: {
      $: "Struct",
      fields: {
        user: { $: "String" },
      },
    },
    leave: {
      $: "Struct",
      fields: {
        user: { $: "String" },
      },
    },
    continue: {
      $: "Struct",
      fields: {
        user: { $: "String" },
      },
    },
    confirm: {
      $: "Struct",
      fields: {
        user: { $: "String" },
      },
    },
    select_uc: {
      $: "Struct",
      fields: {
        user: { $: "String" },
        card: ucPacker,
      },
    },
    select_ue: {
      $: "Struct",
      fields: {
        user: { $: "String" },
        card: uePacker,
      },
    },
    report_action: {
      $: "Struct",
      fields: {
        user: { $: "String" },
        action: actionPacker,
      },
    },
  },
};
