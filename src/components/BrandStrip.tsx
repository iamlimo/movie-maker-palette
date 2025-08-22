const BrandStrip = () => {
  const brands = [
    { name: "WARNER", logo: "WB" },
    { name: "DISNEY", logo: "D+" },
    { name: "NETFLIX", logo: "N" },
    { name: "PARAMOUNT", logo: "P" },
    { name: "UNIVERSAL", logo: "U" },
    { name: "SONY", logo: "S" },
    { name: "MGM", logo: "M" },
    { name: "A24", logo: "A24" }
  ];

  return (
    <section className="py-8 border-y border-border bg-secondary/20">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center space-x-8 md:space-x-12 overflow-x-auto">
          {brands.map((brand, index) => (
            <div 
              key={index}
              className="flex-shrink-0 flex items-center justify-center w-16 h-16 gradient-card rounded-lg border border-border/50 transition-smooth hover:border-primary/50"
            >
              <span className="text-muted-foreground font-bold text-sm">
                {brand.logo}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BrandStrip;