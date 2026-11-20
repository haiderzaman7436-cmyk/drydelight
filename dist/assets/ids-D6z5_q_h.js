function e(t="req"){return typeof crypto<"u"&&typeof crypto.randomUUID=="function"?`${t}_${crypto.randomUUID()}`:`${t}_${Date.now()}_${Math.random().toString(36).slice(2,10)}`}export{e as c};
