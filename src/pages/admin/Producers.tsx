import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useRole } from '@/hooks/useRole';
import { Navigate } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  UserCheck, 
  Clock, 
  CheckCircle, 
  XCircle,
  Users,
  Building2,
  Eye
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Producer {
  id: string;
  user_id: string;
  company_name: string;
  bio: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  producer_name?: string;
  producer_email?: string;
}

const Producers = () => {
  const { isSuperAdmin } = useRole();
  const { toast } = useToast();
  const [producers, setProducers] = useState<Producer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  if (!isSuperAdmin()) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const fetchProducers = async () => {
    try {
      setLoading(true);
      
      // First, get producers data
      let producerQuery = supabase
        .from('producers')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        producerQuery = producerQuery.eq('status', statusFilter as 'pending' | 'approved' | 'rejected');
      }

      const { data: producersData, error: producersError } = await producerQuery;

      if (producersError) {
        console.error('Error fetching producers:', producersError);
        toast({
          title: "Error",
          description: "Failed to fetch producers",
          variant: "destructive",
        });
        return;
      }

      // Get all user IDs from producers
      const userIds = producersData?.map(p => p.user_id) || [];
      
      // Fetch profiles separately
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      // Merge the data
      const enrichedProducers = producersData?.map(producer => {
        const profile = profilesData?.find(p => p.user_id === producer.user_id);
        return {
          ...producer,
          producer_name: profile?.name || 'Unknown',
          producer_email: profile?.email || 'Unknown'
        };
      }) || [];

      // Filter by search term if provided
      let filteredData = enrichedProducers;
      if (searchTerm) {
        filteredData = filteredData.filter(producer => 
          producer.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          producer.producer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          producer.producer_email?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      setProducers(filteredData);
    } catch (error) {
      console.error('Error fetching producers:', error);
      toast({
        title: "Error",
        description: "Failed to fetch producers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateProducerStatus = async (producerId: string, newStatus: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('producers')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', producerId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Producer ${newStatus} successfully`,
      });

      fetchProducers();
    } catch (error) {
      console.error('Error updating producer status:', error);
      toast({
        title: "Error",
        description: "Failed to update producer status",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchProducers();
  }, [statusFilter]);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      fetchProducers();
    }, 300);

    return () => clearTimeout(delayedSearch);
  }, [searchTerm]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'rejected':
        return <XCircle className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      default:
        return <UserCheck className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Producer Management</h1>
          <p className="text-muted-foreground">
            Review and manage producer applications and status
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <Building2 className="h-3 w-3" />
          {producers.length} Producers
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            title: 'Total Producers',
            value: producers.length,
            icon: Users,
            color: 'text-blue-600'
          },
          {
            title: 'Pending Approval',
            value: producers.filter(p => p.status === 'pending').length,
            icon: Clock,
            color: 'text-amber-600'
          },
          {
            title: 'Approved',
            value: producers.filter(p => p.status === 'approved').length,
            icon: CheckCircle,
            color: 'text-emerald-600'
          },
          {
            title: 'Rejected',
            value: producers.filter(p => p.status === 'rejected').length,
            icon: XCircle,
            color: 'text-red-600'
          }
        ].map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Producer Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by company name, producer name, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted/20 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producer</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {producers.map((producer) => (
                  <TableRow key={producer.id}>
                    <TableCell>
                      <div className="font-medium">{producer.producer_name || 'N/A'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {producer.company_name}
                      </div>
                    </TableCell>
                    <TableCell>{producer.producer_email || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge className={`${getStatusColor(producer.status)} flex items-center gap-1 w-fit`}>
                        {getStatusIcon(producer.status)}
                        {producer.status.charAt(0).toUpperCase() + producer.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(producer.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {producer.status === 'pending' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateProducerStatus(producer.id, 'approved')}
                              className="text-emerald-600 hover:text-emerald-700"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateProducerStatus(producer.id, 'rejected')}
                              className="text-red-600 hover:text-red-700"
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!loading && producers.length === 0 && (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No producers found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'Try adjusting your search criteria.' : 'No producer applications yet.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Producers;