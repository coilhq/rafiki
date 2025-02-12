const { MockASE, C9_CONFIG, HLB_CONFIG } = require('test-lib')

;(async () => {
  try {
    await MockASE.create(C9_CONFIG)
    console.debug('Created Cloud Nine Mock ASE')
    await MockASE.create(HLB_CONFIG)
    console.debug('Created Happy Life Bank Mock ASE')
  } catch (error) {
    console.error('Mock ASE encountered error')
    console.error(error)
  }
})()
