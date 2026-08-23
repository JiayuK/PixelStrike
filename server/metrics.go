package main

import (
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

var outboundBytes atomic.Int64
var outboundBPS atomic.Int64
var droppedMessages atomic.Int64
var tickMetrics struct {
	sync.Mutex
	samples [3600]int64
	count   int
	next    int
}

func recordTick(d time.Duration) {
	tickMetrics.Lock()
	tickMetrics.samples[tickMetrics.next] = d.Nanoseconds()
	tickMetrics.next = (tickMetrics.next + 1) % len(tickMetrics.samples)
	tickMetrics.count = min(tickMetrics.count+1, len(tickMetrics.samples))
	tickMetrics.Unlock()
}

func tickPercentiles() (float64, float64, float64) {
	tickMetrics.Lock()
	values := append([]int64(nil), tickMetrics.samples[:tickMetrics.count]...)
	tickMetrics.Unlock()
	if len(values) == 0 {
		return 0, 0, 0
	}
	sort.Slice(values, func(i, j int) bool { return values[i] < values[j] })
	at := func(p float64) float64 {
		return float64(values[min(len(values)-1, int(float64(len(values)-1)*p))]) / 1e6
	}
	return at(.5), at(.95), at(.99)
}

func startMetrics() func() {
	stop := make(chan struct{})
	go func() {
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		last := outboundBytes.Load()
		for {
			select {
			case <-ticker.C:
				cur := outboundBytes.Load()
				outboundBPS.Store(cur - last)
				last = cur
			case <-stop:
				return
			}
		}
	}()
	return func() { close(stop) }
}
