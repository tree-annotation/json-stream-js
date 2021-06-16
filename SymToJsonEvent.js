// todo: make a good impl based on inner functions; after it's tested and benchmarked, inline all the functions and see if it improves things

const _0_ = '0'.charCodeAt(0)
const _1_ = '1'.charCodeAt(0)
const _9_ = '9'.charCodeAt(0)
const _a_ = 'a'.charCodeAt(0)
const _f_ = 'f'.charCodeAt(0)
const _A_ = 'A'.charCodeAt(0)
const _F_ = 'F'.charCodeAt(0)

const _openCurly_ = '{'.charCodeAt(0)
const _openSquare_ = '['.charCodeAt(0)
const _closeCurly_ = '}'.charCodeAt(0)
const _closeSquare_ = ']'.charCodeAt(0)
const _quoteMark_ = '"'.charCodeAt(0)
const _minus_ = '-'.charCodeAt(0)
const _space_ = ' '.charCodeAt(0)
const _newline_ = '\n'.charCodeAt(0)
const _tab_ = '\t'.charCodeAt(0)
const _return_ = '\r'.charCodeAt(0)
const _backslash_ = '\\'.charCodeAt(0)
const _slash_ = '/'.charCodeAt(0)
const _comma_ = ','.charCodeAt(0)
const _colon_ = ':'.charCodeAt(0)
const _t_ = 't'.charCodeAt(0)
const _n_ = 'n'.charCodeAt(0)
const _b_ = 'b'.charCodeAt(0)
const _r_ = 'r'.charCodeAt(0)
const _u_ = 'u'.charCodeAt(0)
const _dot_ = '.'.charCodeAt(0)
const _e_ = 'e'.charCodeAt(0)
const _E_ = 'E'.charCodeAt(0)
const _l_ = 'l'.charCodeAt(0)
const _s_ = 's'.charCodeAt(0)

const isZeroNine = (code) => {
  return code >= _0_ && code <= _9_
}
const isOneNine = (code) => {
  return code >= _1_ && code <= _9_
}
const isWhitespace = (code) => {
  return code === _space_ || code === _newline_ || code === _tab_ || code === _return_
}

// todo?: maybe if eat before emit returns error, the parser should stop with error too

// todo?: make trailing commas invalid by treating first value different from next/last value; OR introduce an option for trailing commas

// SymToJson.make
// todo?: replace f*alse, f[a]lse w/ f|alse, etc.
// todo: nice error msgs

// todo: check if next.push(type) is more optimal than next.push({type})
//    and if next.push(JsonEventType.buffer, sym) is more optimal than next.push({type: JsonEventType.buffer, sym})
//    another opton: next.push(JsonEventType.buffer, {sym})

// todo: built-in line, col, pos information; in particular in returned {id: error} feedback msgs

// todo: more test suites


// possible opt: dont emit eat on true, false, null (marginal)
// todo: should we continue to throw if (isDone) or ret error?


export const JsonEventType = {
  openObject: 'open object',
  openArray: 'open array',
  openString: 'open string',
  openNumber: 'open number',
  // todo?: just have [close]true, false, null
  openTrue: 'open true',
  openFalse: 'open false',
  openNull: 'open null',
  closeObject: 'close object',
  closeArray: 'close array',
  closeString: 'close string',
  closeNumber: 'close number',
  closeTrue: 'close true',
  closeFalse: 'close false',
  closeNull: 'close null',

  openKey: 'open key',
  openHex: 'open hex',
  closeKey: 'close key',
  closeHex: 'close hex',

  // todo: perhaps rename to symbol or sym or sth
  buffer: 'buffer',
  escape: 'escape',
  whitespace: 'whitespace',
  comma: 'comma',
  colon: 'colon',

  end: 'end',
}

export const SymToJsonEvent = (next) => {
  let mode = '*value'
  let isDone = false
  let parents = ['top']
  let hexSeqIdx = 0

  // todo: perhaps remove reset
  // ? todo: error recovery mechanism that doesn't reset state completely?
  const reset = () => {
    mode = '*value'
    isDone = false
    parents = ['top']
    hexSeqIdx = 0
  }

  // todo?: remove, error on end shows only choiceId
  const dumpState = () => JSON.stringify({
    mode, 
    parents,
  })

  const eat = (sym) => { return next.push({id: JsonEventType.buffer, sym}) }
  // todo: eatEmitFork
  const eatFork = (sym, nextMode) => {
    mode = nextMode
    return next.push({id: JsonEventType.buffer, sym})
  }
  const eatPrefix = (sym) => { return next.push({id: JsonEventType.whitespace, sym}) }
  // todo: add sym arg, eatEmit
  const emit = (id, nextMode) => {
    mode = nextMode
    // todo: id -> type
    return next.push({id})
  }
  // -todo: add sym arg, eatEmitValue
  // todo? in most cases eat, emitvalue could be replaced with eatemitvalue
  const emitValue = (id) => {
    const parent = parents[parents.length - 1]
    return emit(id, parent === 'top'? '*value': 'value*')
  }

  const error = (message) => {
    // todo? special error status
    isDone = true
    return {id: 'error', message}
  }
  const fraction = (sym, code) => {
    if (code === _dot_) return eatFork(sym, '0-9.*')
    return exponent(sym, code)
  }
  const exponent = (sym, code) => {
    if (code === _e_ || code === _E_) return eatFork(sym, 'exp*')
    return number(sym)
  }
  const number = (sym) => {
    // we assume here that sym is a non-numeric symbol that terminates the number
    // note: eatemitvalue is not suitable here
    // so this says that the previous symbol was the last of the number
    emitValue(JsonEventType.closeNumber)
    // the terminating symbol is part of what comes after the number -- essentially a space or a comma or a parent close
    // let the standard flow handle that

    // todo: perhaps don't recompute code
    // return value*|*value(sym)
    return self.push(sym)
  }

  const closeParent = (sym, code) => {
    const parent = parents[parents.length - 1]
    if (code === _closeCurly_ && parent === 'object') {
      parents.pop()
      // could eatEmitValue just as well
      // eatEmitValue(sym, JsonEventType.closeObject)
      return emitValue(JsonEventType.closeObject)
    } 
    if (code === _closeSquare_ && parent === 'array') {
      parents.pop()
      // could eatEmitValue just as well
      // eatEmitValue(sym, JsonEventType.closeArray)
      return emitValue(JsonEventType.closeArray)
    }
    if (parent === 'top') {
      return error(`Unexpected top-level symbol ${sym}`)
    }
    return error(`Expected whitespace or comma or ${parent} close, got ${sym}`)
  }

  const self = {
    // todo: should reset stay?
    reset,
    isDone: () => isDone,
    push: (sym) => {
      if (isDone) throw Error(`.push() called after done! ${dumpState()}`)
      const code = sym.charCodeAt(0)
      switch (mode) {
        case '*value': switch (code) {
          case _openCurly_: {
            parents.push('object')
            parents.push('key')
            // todo: eatEmitFork(sym, JsonEventType.openObject, '*key')
            return emit(JsonEventType.openObject, '*key')
          }
          case _openSquare_: {
            parents.push('array')
            // todo: eatEmitFork(sym, openArray, '*value')
            return emit(JsonEventType.openArray, '*value')
          }
          // todo: eatEmitFork(sym, JsonEventType.openString, '"*')
          case _quoteMark_: return emit(JsonEventType.openString, '"*')
          // todo: eatEmitFork(sym, JsonEventType.openTrue, 't*rue')
          case _t_: return emit(JsonEventType.openTrue, 't*rue')
          // todo: eatEmitFork(sym, JsonEventType.openFalse, 'f*alse')
          case _f_: return emit(JsonEventType.openFalse, 'f*alse')
          // todo: eatEmitFork(sym, JsonEventType.openNull, 'n*ull')
          case _n_: return emit(JsonEventType.openNull, 'n*ull')
          // todo: eatEmitFork(sym, JsonEventType.openNumber, '-*')
          case _minus_: {
            emit(JsonEventType.openNumber, '-*')
            return eat(sym)
          }
          // todo: eatEmitFork(sym, JsonEventType.openNumber, '0*')
          case _0_: {
            emit(JsonEventType.openNumber, '0*')
            return eat(sym)
          }
          default: {
            // todo: eatEmitFork(sym, JsonEventType.openNumber, '1-9*')
            // todo: '1-9*' -> '[1-9]*'
            if (isOneNine(code)) {
              emit(JsonEventType.openNumber, '1-9*')
              return eat(sym)
            }
            if (isWhitespace(code)) return eatPrefix(sym)
            return closeParent(sym, code)
          }
        }
        case 'value*': {
          if (code === _comma_) {
            const parent = parents[parents.length - 1]

            if (parent === 'object') {
              parents.push('key')
              // todo: eatEmitFork(sym, JsonEventType.comma, '*key')
              return emit(JsonEventType.comma, '*key')
            } 
            // todo: eatEmitFork(sym, JsonEventType.comma, '*value')
            // todo: set comma flag here and crash if next is closeParent
            if (parent === 'array') return emit(JsonEventType.comma, '*value')
            return error(`Unexpected parent ${parent}`)
          }
          if (isWhitespace(code)) return eatPrefix(sym)
          return closeParent(sym, code)
        } 
        case '*key': {
          // todo: eatEmitFork(sym, JsonEventType.openKey, '"*')
          if (code === _quoteMark_) return emit(JsonEventType.openKey, '"*')
          if (code === _closeCurly_) {
            parents.pop()
            parents.pop()
            // eatemitvalue would work here too
            // eatEmitValue(sym, JsonEventType.closeObject)
            return emitValue(JsonEventType.closeObject)
          } 
          if (isWhitespace(code)) return eatPrefix(sym)
          
          return error(`Expected whitespace or " or object close, got ${sym}`)
        } 
        case 'key*': {
          if (code === _colon_) {
            parents.pop()
            // todo: eatEmitFork(sym, JsonEventType.colon, '*value')
            return emit(JsonEventType.colon, '*value')
          } 
          if (isWhitespace(code)) return eatPrefix(sym)
          return error(`Expected : or whitespace, got ${sym}`)
        }
        case '"*': {
          if (code === _quoteMark_) {
            const parent = parents[parents.length - 1]
            // note: eatemitvalue
            // todo: eatEmitFork(sym, 'key', 'key*')
            // eat(sym)
            if (parent === 'key') return emit(JsonEventType.closeKey, 'key*')
            // hmm
            // todo: eatEmitValue(sym, JsonEventType.closeString)
            return emitValue(JsonEventType.closeString)
          } 
          // todo: eatEmitFork(sym, JsonEventType.escape, '\\*')
          if (code === _backslash_) return emit(JsonEventType.escape, '\\*')
          
          // todo: eatEmit(sym, 'mid string')
          if (code >= 0x0020 && code <= 0x10ffff) return eat(sym)
          
          return error(`Unexpected control character: ${code}`)
        } 
        case '\\*': {
          if (
            code === _quoteMark_ || code === _n_ ||
            code === _backslash_ || code === _t_ ||
            code === _slash_ || code === _b_ ||
            code === _f_ || code === _r_
          ) return eatFork(sym, '"*')
          if (code === _u_) return emit(JsonEventType.openHex, '\\u*')
          return error(`Invalid escape character: ${sym}`)
        } 
        case '\\u*': {
          // '0123456789abcdefABCDEF'.includes(sym)
          if (
            (code >= _0_ && code <= _9_) ||
            (code >= _a_ && code <= _f_) ||
            (code >= _A_ && code <= _F_)
          ) {
            if (hexSeqIdx < 3) {
              hexSeqIdx += 1
              return eat(sym)
            }
            hexSeqIdx = 0
            return emit(JsonEventType.closeHex, '"*')
          }
          return error(`Invalid hexadecimal escape character: ${sym}`)
        } 
        case '-*': {
          if (code === _0_) return eatFork(sym, '0*')
          if (isOneNine(code)) return eatFork(sym, '1-9*')
          return error(`Expected -[0-9], got -[${sym}]`)
        } 
        case '0*': return fraction(sym, code)
        case '1-9*': {
          if (isZeroNine(code)) return eatFork(sym, '1-90-9*')
          else return fraction(sym, code)
        } 
        case '0-9.*': {
          if (isZeroNine(code)) return eatFork(sym, '0-9.0-9*')
          return error(`Expected 0-9, got ${sym}`)
        } 
        case 'exp*': {
          if (sym === '+' || sym === '-') return eatFork(sym, 'exp+-*')
          if (isZeroNine(code)) return eatFork(sym, 'exp+-0-9')
          return error(`Expected +-0..9, got ${sym}`)
        }
        case 'exp+-*': {
          if (isZeroNine(code)) return eatFork(sym, 'exp+-0-9')
          return error(`Expected digit, got ${sym}`)
        } 
        case '1-90-9*': {
          if (isZeroNine(code)) return eat(sym)
          return fraction(sym, code)
        } 
        case '0-9.0-9*': {
          if (isZeroNine(code)) return eat(sym)
          return exponent(sym, code)
        }
        case 'exp+-0-9': {
          if (isZeroNine(code)) return eat(sym)
          return number(sym)
        } 
        case 't*rue': {
          if (code === _r_) return eatFork(sym, 'tr*ue')
          return error(`Expected t[r]ue, got t[${sym}]...`)
        } 
        case 'tr*ue': {
          // todo: don't eat literals
          if (code === _u_) return eatFork(sym, 'tru*e')
          return error(`Expected tr[u]e, got tr[${sym}]...`)
        } 
        case 'tru*e': {
          if (code === _e_) {
            eat(sym)
            return emitValue(JsonEventType.closeTrue)
          }
          return error(`Expected tru[e], got tru[${sym}]...`)
        } 
        case 'f*alse': {
          if (code === _a_) return eatFork(sym, 'fa*lse')
          return error(`Expected f[a]lse, got f[${sym}]...`)
        } 
        case 'fa*lse': {
          if (code === _l_) return eatFork(sym, 'fal*se')
          return error(`Expected fa[l]se, got fa[${sym}]...`)
        } 
        case 'fal*se': {
          if (code === _s_) return eatFork(sym, 'fals*e')
          return error(`Expected fal[s]e, got fal[${sym}]...`)
        } 
        case 'fals*e': {
          if (code === _e_) {
            eat(sym)
            return emitValue(JsonEventType.closeFalse)
          }
          return error(`Expected fals[e], got fals[${sym}]...`)
        } 
        case 'n*ull': {
          if (code === _u_) return eatFork(sym, 'nu*ll')
          return error(`Expected n[u]ll, got n[${sym}]...`)
        } 
        case 'nu*ll': {
          if (code === _l_) return eatFork(sym, 'nul*l')
          return error(`Expected nu[l]l, got nu[${sym}]...`)
        } 
        case 'nul*l': {
          if (code === _l_) {
            eat(sym)
            return emitValue(JsonEventType.closeNull)
          }
          return error(`Expected nul[l], got nul[${sym}]...`)
        }
        default: throw Error(`Invalid parser mode: ${mode}`)
      }
    },
    end: () => {
      if (isDone) throw Error(`.end() called after done! ${dumpState()}`)
      isDone = true

      switch (mode) {
        case '*value': {
          // todo? or push event, then call next.end() w/o args
          return next.end({id: JsonEventType.end})
        }
        default: {
          // n_structure_unclosed_array.json
          if (['exp+-0-9', '1-9*', '1-90-9*', '0-9.0-9*', '0*'].includes(mode)) {
            if (parents[parents.length - 1] === 'top') {
              // eatemitvalue would not work here
              emitValue(JsonEventType.closeNumber)
              return next.end({id: JsonEventType.end})
            }
            return error(`todo: invalid end state ${dumpState()}`)
          }

          // todo: case 'value*') return error('Unclosed array')
          // todo: case '*key') return error('Unclosed object')
          
          // todo: fix msg
          return error(`todo: invalid end state ${dumpState()}`)
        }
      }
    },
  }

  return self
}