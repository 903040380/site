const STATES = {
  pending: 'pending',
  fulfilled: 'fulfilled',
  rejected: 'rejected',
}

function MyPromiseError(message) {
  return `Uncaught (in myPromise) ${message}`
}

class myPromise {
  // 初始化state为等待态
  state = STATES.pending
  // 成功的值
  value = undefined
  // 失败的原因
  reason = undefined
  // onFulfilled事件订阅者
  onFulfilledCallbacks = []
  // onRejected事件订阅者
  onRejectedCallbacks = []

  constructor(executor) {
    if (typeof executor !== 'function') {
      throw '参数executor不是函数'
    }

    // 成功
    const resolve = (value) => {
      if (this.state === STATES.pending) {
        this.value = value
        this.state = STATES.fulfilled

        // 发布onFulfilled事件通知
        this.onFulfilledCallbacks.forEach((fn) => fn())
      }

      console.log('resolve', this.state, this.value, this.reason)
    }

    // 失败
    const reject = (reason) => {
      if (this.state === STATES.pending) {
        this.reason = reason
        this.state = STATES.rejected
        console.log(222222, this.state, this.reason)

        // 发布onRejected事件通知
        this.onRejectedCallbacks.forEach((fn) => fn())
      }

      // ? promise如何实现的报错提示，promise会先返回值再提示报错，普通值和异步值都是
      // 此处模拟实现则是普通值是先提示报错再返回，因为先执行console.error才执行完，异步值才是先返回再报错
      console.error(MyPromiseError(reason))

      console.log('reject', this.state, this.value, this.reason)
    }

    try {
      // 立即执行回调executor
      executor(resolve, reject)
    } catch (e) {
      reject(e)
    }
  }

  then(onFulfilled, onRejected) {
    console.log('---', 'then', '---')

    if (typeof onFulfilled !== 'function') {
      onFulfilled = (value) => value
    }
    if (typeof onRejected !== 'function') {
      onRejected = (reason) => {
        throw reason
      }
    }

    // 实现链式调用
    const promise2 = new myPromise((resolve, reject) => {
      // 成功的任务立即执行onFulfilled回调并返回
      if (this.state === STATES.fulfilled) {
        try {
          console.log('onFulfilled', this.state, this.value, this.reason)

          const x = onFulfilled(this.value)
          resolvePromise(promise2, x, resolve, reject)
        } catch (e) {
          reject(e)
        }
      }

      // 失败的任务立即执行onRejected回调并返回
      if (this.state === STATES.rejected) {
        try {
          console.log('onRejected', this.state, this.value, this.reason)

          const x = onRejected(this.reason)
          resolvePromise(promise2, x, resolve, reject)
        } catch (e) {
          reject(e)
        }
      }

      // 还没有结果的异步任务
      if (this.state === 'pending') {
        console.log('异步事件等待完成', this.state, this.value, this.reason)

        // 订阅onFulfilled事件
        this.onFulfilledCallbacks.push(() => {
          try {
            const x = onFulfilled(this.value)
            resolvePromise(promise2, x, resolve, reject)
          } catch (e) {
            reject(e)
          }
        })

        // 订阅onRejected事件
        this.onRejectedCallbacks.push(() => {
          try {
            const x = onRejected(this.reason)
            resolvePromise(promise2, x, resolve, reject)
          } catch (e) {
            reject(e)
          }
        })
      }
    })

    console.log('---', '---')

    return promise2
  }

  catch(onRejected) {
    // 就是一个只处理失败态的 then
    return this.then(undefined, onRejected)
  }

  // ! 需要resolvePromise支持
  finally(onFinally) {
    // 就是一个，成功和失败都执行onFinally，且返回一个onFinally返回值的then
    return this.then(
      (value) => myPromise.resolve(onFinally()).then(() => value),
      (reason) =>
        myPromise.resolve(onFinally()).then(() => {
          throw reason
        }),
    )
  }

  static resolve(value) {
    return new myPromise((resolve, reject) => {
      resolve(value)
    })
  }

  static reject(value) {
    return new myPromise((resolve, reject) => {
      reject(value)
    })
  }

  static all(promises) {
    return new myPromise((resolve, reject) => {
      const result = []
      // 记录完成次数
      let count = 0

      const handleResult = (index, value) => {
        result[index] = value
        count++
        // 全部完成则resolve
        if (count === promises.length) {
          resolve(result)
        }
      }

      for (let i = 0; i < promises.length; i++) {
        // 获取每一个异步任务
        const p = promises[i]

        if (p && typeof p.then === 'function') {
          // 异步值，异步结束获取结果
          p.then((value) => {
            handleResult(i, value)
          }, reject) // 有一个失败则直接reject
        } else {
          // 普通值，直接获取结果
          handleResult(i, p)
        }
      }
    })
  }

  static allSettled(promises) {
    return new myPromise((resolve, reject) => {
      const result = new Array(promises.length)
      // 记录完成次数
      let count = 0

      const handleResult = (index, value) => {
        result[index] = value
        count++
        // 全部完成则resolve
        if (count === promises.length) {
          resolve(result)
        }
      }

      for (let i = 0; i < promises.length; i++) {
        // 获取每一个异步任务
        const p = promises[i]

        if (p && typeof p.then === 'function') {
          // 异步值，异步结束获取结果
          p.then((value) => {
            handleResult(i, value)
          }).catch((reason) => {
            handleResult(i, reason)
          })
        } else {
          // 普通值，直接获取结果
          handleResult(i, p)
        }
      }
    })
  }

  static race(promises) {
    return new myPromise((resolve, reject) => {
      for (let i = 0; i < promises.length; i++) {
        // 获取每一个异步任务
        const p = promises[i]

        if (p && typeof p.then === 'function') {
          // 异步值，使用第一个触发then的
          p.then(resolve, reject)
        } else {
          // 普通值，直接获取结果
          resolve(p)
        }
      }
    })
  }

  static any(promises) {
    const rejectedArr = new Array(promises.length)

    return new myPromise((resolve, reject) => {
      for (let i = 0; i < promises.length; i++) {
        // 获取每一个异步任务
        const p = promises[i]

        if (p && typeof p.then === 'function') {
          // 异步值，使用第一个成功的，失败的存到数组直到全部失败则返回
          p.then(resolve, (reason) => {
            rejectedArr[i] = reason
            if (rejectedArr.length === promises.length) {
              reject(rejectedArr)
            }
          })
        } else {
          // 普通值，直接获取结果
          resolve(p)
        }
      }
    })
  }
}

function resolvePromise(promise2, x, resolve, reject) {
  // 根据返回值 x 的情况，调用 promise2 的 resolve 或 reject 函数

  // 返回值循环引用
  if (promise2 === x) {
    return reject(new TypeError('循环引用'))
  }

  // 返回值 x 是对象或函数的情况
  if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
    try {
      const then = x.then
      if (typeof then === 'function') {
        // then 是函数：就认为 x 为 Promise 类型

        // 返回值 x 为 Promise，调用 then 看结果
        then.call(
          x,
          (y) => {
            resolve(y) // 成功
          },
          (r) => {
            reject(r) // 失败
          },
        )
      } else {
        resolve(x) // 普通值
      }
    } catch (e) {
      reject(e)
    }
  } else {
    console.log('应该是普通值')
    // 普通值
    resolve(x)
  }
}
