

# postfixUnless = pr([ toState("unless"), linespace, -> expression ]).onMatch (m, state) -> { unless: m[1], state: m[0] }
# postfixUntil = pr([ toState("until"), linespace, -> expression ]).onMatch (m, state) -> { until: m[1], state: m[0] }
