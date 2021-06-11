import {SymToJsonEvent} from './SymToJsonEvent.js'

const bsample = `
{
    "firstName": "John",
    "lastName" : "Smith",
    "age"      : 25,
    "address"  :
    {
        "streetAddress": "21 2nd Street",
        "city"         : "New York",
        "state"        : "NY",
        "postalCode"   : "10021"
    },
    "phoneNumber":
    [
        {
          "type"  : "home",
          "number": "212 555-1234"
        },
        {
          "type"  : "fax",
          "number": "646 555-4567"
        }
    ]
}`

console.time('bench')
for (let i = 0; i < 100000; ++i) {
  const stream = SymToJsonEvent({push: () => {}, end: () => {}})
  for (const c of bsample) {
    stream.push(c)
  }
  stream.end()
}
console.timeEnd('bench')
// pretty fast: bench: 2126ms
// vs clarinet
// https://github.com/dscape/clarinet/blob/master/bench/results/sync/dscape-wikipedia.csv
// > 2x faster