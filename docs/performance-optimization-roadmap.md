# ERP Application Performance Optimization Roadmap

This document outlines comprehensive optimization opportunities identified in the ERP application codebase. Each optimization is categorized by impact level and includes specific implementation details.



## 🔥 **HIGH IMPACT OPTIMIZATIONS (P0) MOSTLY DONE**

### **1. Query Optimization Enhancements**

**Current State**: `useChainedQuery` is already well-optimized with smart dependency checking and query disabling.

**Additional Optimizations**:

#### **1.1 Query Result Memoization & Selection**
```typescript
// In useChainedQuery.ts - Add select functions for data transformation
return queryOptions({
  queryKey: partnerKeys.list(params),
  queryFn: () => partnerService.fetchPartners(params),
  select: (data) => ({
    ...data,
    data: data.data.map(partner => ({
      ...partner,
      displayName: `${partner.name} (${partner.code})`, // Pre-compute display values
      isActive: partner.approvalStatus === 'APPROVED'
    }))
  }),
  staleTime: 5 * 60 * 1000, // 5 minutes for partner data
  enabled: hasRequiredDependencies
});
```

#### **1.2 Strategic Stale Time Configuration**
```typescript
// Different stale times based on data volatility
const STALE_TIMES = {
  JOURNALS: 30 * 60 * 1000,    // 30 min - rarely change
  PARTNERS: 10 * 60 * 1000,    // 10 min - semi-stable
  GOODS: 5 * 60 * 1000,        // 5 min - more dynamic
  DOCUMENTS: 1 * 60 * 1000,    // 1 min - frequently updated
};
```

**Files**: `src/hooks/useChainedQuery.ts`, all feature manager hooks

---

### **2. Zustand Store Optimizations**

**Current Issues**:
- Selector functions create new objects on every render
- No state persistence for user preferences
- Broad state subscriptions causing unnecessary re-renders

#### **2.1 Memoized Selectors**
```typescript
// Create memoized selector utilities
export const createMemoizedSelectors = () => {
  const cache = new Map();
  
  return {
    visibleSliders: (state) => {
      const key = `${state.sliderOrder.join(',')}-${Object.values(state.visibility).join('')}`;
      if (!cache.has(key)) {
        cache.set(key, state.sliderOrder.filter(id => state.visibility[id]));
      }
      return cache.get(key);
    },
    
    effectiveFilters: (state) => {
      const key = `${state.selections.journal.rootFilter.join('-')}`;
      if (!cache.has(key)) {
        cache.set(key, {
          hasAffected: state.selections.journal.rootFilter.includes('affected'),
          hasUnaffected: state.selections.journal.rootFilter.includes('unaffected'),
          hasInProcess: state.selections.journal.rootFilter.includes('inProcess')
        });
      }
      return cache.get(key);
    }
  };
};
```

#### **2.2 State Persistence**
```typescript
// Add persistence for user preferences
import { persist } from 'zustand/middleware';

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ... existing store logic
    }),
    {
      name: 'erp-user-preferences',
      partialize: (state) => ({
        ui: {
          sliderOrder: state.ui.sliderOrder,
          visibility: state.ui.visibility,
        },
        theme: state.currentTheme,
        // Don't persist sensitive selections
      }),
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

#### **2.3 Granular State Subscriptions**
```typescript
// Use specific selectors to minimize re-renders
const useSliderVisibility = () => useAppStore(state => state.ui.visibility);
const useSliderOrder = () => useAppStore(state => state.ui.sliderOrder);
const useJournalSelection = () => useAppStore(state => state.selections.journal);

// Instead of subscribing to entire store
const Component = () => {
  const visibility = useSliderVisibility(); // Only re-renders when visibility changes
  const order = useSliderOrder(); // Only re-renders when order changes
  // ...
};
```

**Files**: `src/store/index.ts`, `src/store/slices/*.ts`

---

### **3. Component Re-rendering Optimizations**

#### **3.1 DynamicSlider Performance**
**Current Issues**: Heavy Swiper re-initialization, expensive calculations

```typescript
// Optimize DynamicSlider with React.memo and useMemo
const DynamicSlider = React.memo(({ sliderId, data, onItemSelect, isLocked }) => {
  // Memoize expensive calculations
  const filterDots = useMemo(() => 
    data.map(item => calculateFilterDot(item, activeFilters)),
    [data, activeFilters] // Only recalculate when data or filters change
  );

  // Memoize Swiper configuration
  const swiperConfig = useMemo(() => ({
    spaceBetween: 10,
    slidesPerView: 'auto',
    freeMode: true,
    mousewheel: true,
    key: `${sliderId}-${data.length}-${isLocked}` // Stable key
  }), [sliderId, data.length, isLocked]);

  // Memoize slide components
  const slides = useMemo(() => 
    data.map((item, index) => (
      <MemoizedSlideComponent
        key={item.id}
        item={item}
        filterDot={filterDots[index]}
        isSelected={selectedItems.has(item.id)}
        onClick={() => onItemSelect(item)}
      />
    )),
    [data, filterDots, selectedItems, onItemSelect]
  );

  return (
    <Swiper {...swiperConfig}>
      {slides}
    </Swiper>
  );
});

// Memoized slide component
const MemoizedSlideComponent = React.memo(({ item, filterDot, isSelected, onClick }) => (
  <SwiperSlide>
    <div 
      className={`slide ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      {item.displayName}
      {filterDot && <FilterDot type={filterDot} />}
    </div>
  </SwiperSlide>
));
```

#### **3.2 Modal and Form Optimizations**
```typescript
// Lazy load heavy modals
const DocumentCreationModal = lazy(() => 
  import('@/features/documents/components/DocumentCreationModal')
);

// Optimize form re-renders with useCallback
const FormComponent = () => {
  const handleSubmit = useCallback((data) => {
    // submission logic
  }, []); // Empty dependency array if no external deps

  const handleFieldChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Form onSubmit={handleSubmit} onChange={handleFieldChange} />
    </Suspense>
  );
};
```

**Files**: `src/features/shared/components/DynamicSlider.tsx`, modal components throughout features

---

## 🚀 **MEDIUM IMPACT OPTIMIZATIONS (P1)**

### **4. Advanced Data Fetching Patterns**

#### **4.1 Request Deduplication**
```typescript
// Implement shared query instances across components
const useSharedPartnerQuery = (params) => {
  const queryKey = partnerKeys.list(params);
  return useQuery({
    queryKey,
    queryFn: () => partnerService.fetchPartners(params),
    // Multiple components using same params will share this query
  });
};
```

#### **4.2 Optimistic Updates**
```typescript
// Add optimistic updates for better UX
const usePartnerMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: partnerService.updatePartner,
    onMutate: async (newPartner) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: partnerKeys.all });
      
      // Snapshot previous value
      const previousPartners = queryClient.getQueryData(partnerKeys.list({}));
      
      // Optimistically update
      queryClient.setQueryData(partnerKeys.list({}), old => ({
        ...old,
        data: old.data.map(p => p.id === newPartner.id ? { ...p, ...newPartner } : p)
      }));
      
      return { previousPartners };
    },
    onError: (err, newPartner, context) => {
      // Rollback on error
      queryClient.setQueryData(partnerKeys.list({}), context.previousPartners);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: partnerKeys.all });
    },
  });
};
```

#### **4.3 Background Data Prefetching**
```typescript
// Prefetch related data based on user interactions
const useDataPrefetching = () => {
  const queryClient = useQueryClient();
  
  const prefetchRelatedData = useCallback((entityType, entityId) => {
    switch (entityType) {
      case 'partner':
        // Prefetch goods for this partner
        queryClient.prefetchQuery({
          queryKey: goodKeys.list({ partnerIds: [entityId] }),
          queryFn: () => goodService.findGoodsForPartners([entityId]),
          staleTime: 2 * 60 * 1000 // 2 minutes
        });
        break;
      case 'journal':
        // Prefetch partners for this journal
        queryClient.prefetchQuery({
          queryKey: partnerKeys.list({ journalIds: [entityId] }),
          queryFn: () => partnerService.fetchPartners({ journalIds: [entityId] }),
          staleTime: 2 * 60 * 1000
        });
        break;
    }
  }, [queryClient]);
  
  return { prefetchRelatedData };
};
```

**Files**: All `use*Manager.ts` hooks in features

---

### **5. Backend API Optimizations**

#### **5.1 Response Caching**
```typescript
// Add Redis/memory caching to API routes
import { Redis } from '@upstash/redis';
const redis = new Redis({ /* config */ });

export const GET = withAuthorization(async function GET(request, _context, session) {
  const url = new URL(request.url);
  const cacheKey = `partners-${url.searchParams.toString()}-${session.user.id}`;
  
  // Check cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }
  
  // Fetch from database
  const result = await partnerService.getAllPartners(options);
  
  // Cache result (5 minutes for partner data)
  await redis.setex(cacheKey, 300, result);
  
  return NextResponse.json(result);
});
```

#### **5.2 Database Query Optimization**
```typescript
// Optimize Prisma queries with includes and selects
const optimizedPartnerQuery = {
  select: {
    id: true,
    name: true,
    code: true,
    approvalStatus: true,
    // Only select needed fields
  },
  include: {
    // Use selective includes
    journalPartnerLinks: {
      where: { 
        journal: { 
          id: { in: journalIds } 
        } 
      },
      select: {
        id: true,
        partnershipType: true,
        journal: {
          select: { id: true, name: true }
        }
      }
    }
  },
  // Add database-level filtering
  where: {
    AND: [
      { approvalStatus: 'APPROVED' },
      { entityState: 'ACTIVE' },
      journalIds.length > 0 ? {
        journalPartnerLinks: {
          some: {
            journal: { id: { in: journalIds } }
          }
        }
      } : {}
    ]
  }
};
```

#### **5.3 Connection Pooling**
```typescript
// Optimize Prisma client configuration
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Optimize connection pooling
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Add connection pool size optimization
export const config = {
  maxDuration: 30, // 30 seconds max for API routes
};
```

**Files**: `src/app/api/*/route.ts`, `src/app/services/*.ts`

---

### **6. Bundle Size & Code Splitting**

#### **6.1 Dynamic Feature Loading**
```typescript
// Lazy load major features
const SliderComponents = {
  JOURNAL: lazy(() => import('@/features/journals/JournalSliderController')),
  PARTNER: lazy(() => import('@/features/partners/PartnerSliderController')),
  GOODS: lazy(() => import('@/features/goods/GoodsSliderController')),
  DOCUMENT: lazy(() => import('@/features/documents/DocumentSliderController')),
};

// Route-based code splitting
const AdminPanel = lazy(() => import('./admin/page'));
const Reports = lazy(() => import('./reports/page'));
```

#### **6.2 Library Optimization**
```typescript
// Tree-shake large libraries
import { motion } from 'framer-motion'; // Instead of entire library
import { debounce } from 'lodash/debounce'; // Specific function import

// Replace heavy libraries with lighter alternatives
import { clsx } from 'clsx'; // Instead of classnames
import { nanoid } from 'nanoid'; // Instead of uuid
```

#### **6.3 Bundle Analysis Configuration**
```javascript
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizeCss: true, // CSS optimization
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Client-side bundle optimizations
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    // Add bundle analyzer in development
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'server',
          openAnalyzer: true,
        })
      );
    }
    
    return config;
  },
  // Add compression
  compress: true,
  // Optimize images
  images: {
    formats: ['image/webp', 'image/avif'],
  },
};
```

**Files**: `next.config.mjs`, `src/app/layout.tsx`, feature components

---

## ⚡ **LOW IMPACT / NICE-TO-HAVE OPTIMIZATIONS (P2-P3)**

### **7. React Query Global Configuration**

```typescript
// Optimize global React Query settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Prevent unnecessary background refetches
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
      refetchOnMount: true,
      
      // Strategic retry logic
      retry: (failureCount, error) => {
        // Don't retry 4xx errors
        if (error.status >= 400 && error.status < 500) return false;
        return failureCount < 3;
      },
      
      // Default stale time
      staleTime: 30 * 1000, // 30 seconds
      
      // Garbage collection time
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
    mutations: {
      retry: 1,
      // Global error handling
      onError: (error) => {
        console.error('Mutation error:', error);
        // Could integrate with error reporting service
      },
    },
  },
});
```

### **8. Performance Monitoring**

```typescript
// Add performance tracking
const usePerformanceMonitoring = () => {
  useEffect(() => {
    // Monitor Core Web Vitals
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'largest-contentful-paint') {
            console.log('LCP:', entry.startTime);
          }
          if (entry.entryType === 'first-input') {
            console.log('FID:', entry.processingStart - entry.startTime);
          }
        });
      });
      
      observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input'] });
      
      return () => observer.disconnect();
    }
  }, []);
};

// Add query performance tracking
const useQueryPerformanceTracking = () => {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const cache = queryClient.getQueryCache();
    
    const unsubscribe = cache.subscribe((event) => {
      if (event.type === 'queryAdded') {
        const startTime = Date.now();
        
        event.query.subscribe((query) => {
          if (query.state.status === 'success' || query.state.status === 'error') {
            const endTime = Date.now();
            console.log(`Query ${event.query.queryHash} took ${endTime - startTime}ms`);
          }
        });
      }
    });
    
    return unsubscribe;
  }, [queryClient]);
};
```

### **9. Memory Management**

```typescript
// Add proper cleanup for heavy components
const useComponentCleanup = () => {
  const cleanupFunctions = useRef([]);
  
  const addCleanup = useCallback((fn) => {
    cleanupFunctions.current.push(fn);
  }, []);
  
  useEffect(() => {
    return () => {
      cleanupFunctions.current.forEach(fn => fn());
      cleanupFunctions.current = [];
    };
  }, []);
  
  return { addCleanup };
};

// Use in components with heavy resources
const DynamicSlider = () => {
  const { addCleanup } = useComponentCleanup();
  const swiperRef = useRef(null);
  
  useEffect(() => {
    // Add cleanup for Swiper instance
    addCleanup(() => {
      if (swiperRef.current?.swiper) {
        swiperRef.current.swiper.destroy(true, true);
      }
    });
  }, [addCleanup]);
  
  return <Swiper ref={swiperRef}>...</Swiper>;
};
```

### **10. Image and Asset Optimization**

```typescript
// Implement progressive image loading
const OptimizedImage = ({ src, alt, ...props }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef();
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    
    if (imgRef.current) {
      observer.observe(imgRef.current);
    }
    
    return () => observer.disconnect();
  }, []);
  
  return (
    <div ref={imgRef} className="image-container">
      {isInView && (
        <Image
          src={src}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          className={`transition-opacity ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          {...props}
        />
      )}
    </div>
  );
};
```

---

## 📊 **IMPLEMENTATION PRIORITY MATRIX**

| Optimization Area | Impact | Effort | Priority | Files Affected |
|------------------|--------|--------|----------|----------------|
| Query Result Memoization | High | Low | 🔥 **P0** | `useChainedQuery.ts` |
| Zustand Selector Optimization | High | Medium | 🔥 **P0** | `src/store/*` |
| DynamicSlider Re-render Fix | High | Medium | 🔥 **P0** | `DynamicSlider.tsx` |
| State Persistence | High | Low | 🔥 **P0** | `src/store/index.ts` |
| API Response Caching | Medium | Medium | 🚀 **P1** | `src/app/api/*/*` |
| Request Deduplication | Medium | Low | 🚀 **P1** | Manager hooks |
| Code Splitting | Medium | High | 🚀 **P1** | Layout, Features |
| Database Query Optimization | Medium | Medium | 🚀 **P1** | Service layer |
| React Query Configuration | Low | Low | ⚡ **P2** | `providers.tsx` |
| Performance Monitoring | Low | Medium | ⚡ **P2** | Global hooks |
| Bundle Analysis Setup | Low | Low | ⚡ **P3** | `next.config.mjs` |
| Memory Management | Low | Low | ⚡ **P3** | Heavy components |

---

## 🎯 **QUICK WINS (Can be implemented immediately)**

1. **Add `select` functions to existing queries** (2-3 hours)
2. **Configure `staleTime` based on data volatility** (1 hour)
3. **Add React.memo to DynamicSlider components** (2 hours)
4. **Implement state persistence for user preferences** (3 hours)
5. **Add bundle analyzer to development setup** (30 minutes)

---

## 🔬 **MEASUREMENT STRATEGY**

To measure the effectiveness of these optimizations:

### **Metrics to Track**:
- **Query Performance**: Average query response time, cache hit rate
- **Render Performance**: Component re-render count, paint timing
- **Bundle Size**: JavaScript bundle size, chunk analysis
- **User Experience**: Page load time, Time to Interactive (TTI)
- **Memory Usage**: JavaScript heap size, memory leaks

### **Tools**:
- React DevTools Profiler
- Chrome DevTools Performance tab
- Webpack Bundle Analyzer
- Lighthouse audits
- React Query DevTools

### **Implementation Phases**:

**Phase 1 (Week 1)**: High-impact, low-effort optimizations
- Query memoization and stale time configuration
- Basic React.memo implementations
- State persistence setup

**Phase 2 (Week 2-3)**: Medium-impact optimizations
- Advanced query patterns (optimistic updates, prefetching)
- Component optimization deep dive
- Basic API caching

**Phase 3 (Week 4+)**: Infrastructure optimizations
- Code splitting implementation
- Advanced caching strategies
- Performance monitoring setup

This roadmap provides a systematic approach to optimizing the ERP application's performance while maintaining code quality and user experience.